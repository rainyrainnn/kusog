"""KUSOG YOLO26n server for the Raspberry Pi MJPEG camera stream."""

from __future__ import annotations

import argparse
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from ultralytics import YOLO

DEFAULT_CAMERA_URL = os.environ.get("KUSOG_CAMERA_URL", "http://10.0.21.205:8000/stream")
DEFAULT_MODEL_PATH = os.environ.get("KUSOG_MODEL_PATH", str(Path(__file__).with_name("yolo26n.pt")))


class DetectionState:
    def __init__(self, model_name: str, class_names: list[str]) -> None:
        self.lock = threading.Lock()
        self.model_name = model_name
        self.class_names = class_names
        self.camera_online = False
        self.width = 0
        self.height = 0
        self.fps: float | None = None
        self.last_frame_at = 0.0
        self.latest_jpeg: bytes | None = None
        self.latest: dict[str, Any] = {
            "detections": [],
            "inferenceTimeMs": 0,
            "width": 0,
            "height": 0,
        }

    def update(self, payload: dict[str, Any], frame_fps: float, frame: Any) -> None:
        encoded, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        with self.lock:
            self.latest = payload
            self.width = int(payload["width"])
            self.height = int(payload["height"])
            self.fps = frame_fps
            self.camera_online = True
            self.last_frame_at = time.monotonic()
            if encoded:
                self.latest_jpeg = buffer.tobytes()

    def mark_offline(self) -> None:
        with self.lock:
            self.camera_online = False

    def health(self) -> dict[str, Any]:
        with self.lock:
            camera_online = self.camera_online and time.monotonic() - self.last_frame_at < 5
            return {
                "status": "ok",
                "modelReady": True,
                "model": self.model_name,
                "classes": self.class_names,
                "camera": "online" if camera_online else "offline",
                "resolution": f"{self.width}x{self.height}" if self.width and self.height else None,
                "fps": round(self.fps, 1) if self.fps is not None else None,
            }

    def detections(self) -> dict[str, Any]:
        with self.lock:
            return dict(self.latest)

    def jpeg(self) -> bytes | None:
        with self.lock:
            return self.latest_jpeg


class YoloHandler(BaseHTTPRequestHandler):
    model: YOLO
    state: DetectionState

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send_json(204, {})

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send_json(200, self.state.health())
            return
        if self.path == "/detections":
            self._send_json(200, self.state.detections())
            return
        if self.path == "/camera":
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Connection", "close")
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.end_headers()
            try:
                while True:
                    jpeg = self.state.jpeg()
                    if jpeg:
                        self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n" + jpeg + b"\r\n")
                        self.wfile.flush()
                    time.sleep(0.1)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        self._send_json(404, {"error": "Not found"})

    def do_POST(self) -> None:
        if self.path != "/detect":
            self._send_json(404, {"error": "Not found"})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            image_bytes = self.rfile.read(content_length)
            image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError("The uploaded image could not be decoded.")
            self._send_json(200, infer_frame(self.model, image))
        except Exception as error:
            self._send_json(400, {"error": str(error)})

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}")


def infer_frame(model: YOLO, frame: Any) -> dict[str, Any]:
    started = time.perf_counter()
    result = model.predict(source=frame, conf=0.25, verbose=False)[0]
    inference_time_ms = (time.perf_counter() - started) * 1000
    detections: list[dict[str, Any]] = []

    if result.boxes is not None:
        for box, confidence, class_id in zip(
            result.boxes.xyxy.tolist(),
            result.boxes.conf.tolist(),
            result.boxes.cls.tolist(),
        ):
            detections.append({
                "className": result.names[int(class_id)],
                "confidence": float(confidence),
                "x1": float(box[0]),
                "y1": float(box[1]),
                "x2": float(box[2]),
                "y2": float(box[3]),
            })

    height, width = frame.shape[:2]
    return {
        "detections": detections,
        "inferenceTimeMs": round(inference_time_ms, 2),
        "width": width,
        "height": height,
    }


def inference_loop(model: YOLO, camera_url: str, state: DetectionState) -> None:
    while True:
        capture = cv2.VideoCapture(camera_url)
        previous_frame_at = time.perf_counter()
        if not capture.isOpened():
            state.mark_offline()
            time.sleep(1)
            continue

        try:
            while True:
                ok, frame = capture.read()
                if not ok or frame is None:
                    state.mark_offline()
                    break
                now = time.perf_counter()
                elapsed = now - previous_frame_at
                previous_frame_at = now
                frame_fps = 1 / elapsed if elapsed > 0 else 0
                state.update(infer_frame(model, frame), frame_fps, frame)
        except Exception as error:
            print(f"Camera inference error: {error}")
            state.mark_offline()
        finally:
            capture.release()
            time.sleep(0.5)


def main() -> None:
    parser = argparse.ArgumentParser(description="KUSOG YOLO26n Raspberry Pi stream server")
    parser.add_argument("--model", default=DEFAULT_MODEL_PATH, help="Path to the YOLO26n model")
    parser.add_argument("--camera-url", default=DEFAULT_CAMERA_URL, help="Raspberry Pi MJPEG stream URL")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=5000)
    args = parser.parse_args()

    print(f"Loading YOLO26n model from {args.model}")
    model = YOLO(args.model)
    model_classes = model.names
    class_names = list(model_classes.values()) if isinstance(model_classes, dict) else list(model_classes)
    state = DetectionState("YOLO26n", [str(class_name) for class_name in class_names])
    YoloHandler.model = model
    YoloHandler.state = state

    worker = threading.Thread(target=inference_loop, args=(model, args.camera_url, state), daemon=True)
    worker.start()

    server = ThreadingHTTPServer((args.host, args.port), YoloHandler)
    print("YOLO26n loaded successfully.")
    print(f"Camera source: {args.camera_url}")
    print(f"KUSOG YOLO backend: http://127.0.0.1:{args.port}")
    print(f"Health: http://127.0.0.1:{args.port}/health")
    print(f"Detections: http://127.0.0.1:{args.port}/detections")
    print("Press CTRL+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping KUSOG YOLO backend...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
