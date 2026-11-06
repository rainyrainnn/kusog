"""Read the Raspberry Pi HX711 and upload active-test readings to Supabase."""

from __future__ import annotations

import json
import math
import os
import statistics
import time
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

import board
import digitalio
from adafruit_hx711.hx711 import HX711


UPLOAD_URL = os.getenv("HX711_UPLOAD_URL", "").strip()
DEVICE_TOKEN = os.getenv("HX711_DEVICE_TOKEN", "").strip()
DT_PIN = int(os.getenv("HX711_DT_GPIO", "5"))
SCK_PIN = int(os.getenv("HX711_SCK_GPIO", "6"))
CALIBRATION_FACTOR = float(os.getenv("HX711_CALIBRATION_FACTOR", "0") or "0")
ZERO_THRESHOLD_GRAMS = max(0.0, float(os.getenv("HX711_ZERO_THRESHOLD_GRAMS", "0")))
SAMPLE_COUNT = max(1, int(os.getenv("HX711_SAMPLE_COUNT", "5")))
TARE_SAMPLE_COUNT = max(SAMPLE_COUNT, int(os.getenv("HX711_TARE_SAMPLE_COUNT", "20")))
UPLOAD_INTERVAL_SECONDS = min(
    60.0,
    max(1.0, float(os.getenv("HX711_UPLOAD_INTERVAL_SECONDS", "5"))),
)
zero_noise_threshold_grams = 0.0
uploader_lock_handle = None


def validate_config() -> None:
    missing = [
        name
        for name, value in (
            ("HX711_UPLOAD_URL", UPLOAD_URL),
            ("HX711_DEVICE_TOKEN", DEVICE_TOKEN),
        )
        if not value
    ]
    if missing:
        raise RuntimeError("Missing environment settings: " + ", ".join(missing))
    endpoint = urlsplit(UPLOAD_URL)
    if endpoint.scheme != "https" or not endpoint.netloc:
        raise RuntimeError("HX711_UPLOAD_URL must be a valid HTTPS URL.")
    if len(DEVICE_TOKEN.encode("utf-8")) < 32:
        raise RuntimeError("HX711_DEVICE_TOKEN must be at least 32 bytes.")
    if not math.isfinite(CALIBRATION_FACTOR):
        raise RuntimeError("HX711_CALIBRATION_FACTOR must be a finite number.")
    if not math.isfinite(ZERO_THRESHOLD_GRAMS):
        raise RuntimeError("HX711_ZERO_THRESHOLD_GRAMS must be a finite number.")
    if not math.isfinite(UPLOAD_INTERVAL_SECONDS):
        raise RuntimeError("HX711_UPLOAD_INTERVAL_SECONDS must be a finite number.")


def connect_sensor() -> HX711:
    global zero_noise_threshold_grams
    data_pin = digitalio.DigitalInOut(getattr(board, f"D{DT_PIN}"))
    data_pin.direction = digitalio.Direction.INPUT
    clock_pin = digitalio.DigitalInOut(getattr(board, f"D{SCK_PIN}"))
    clock_pin.direction = digitalio.Direction.OUTPUT
    sensor = HX711(data_pin, clock_pin)

    tare_samples = [sensor.read() for _ in range(TARE_SAMPLE_COUNT)]
    sensor.tare_value_a = round(statistics.fmean(tare_samples))
    if CALIBRATION_FACTOR != 0:
        measured_noise_grams = (
            3 * statistics.pstdev(tare_samples) / abs(CALIBRATION_FACTOR)
        )
        zero_noise_threshold_grams = max(
            ZERO_THRESHOLD_GRAMS,
            measured_noise_grams,
        )
        print("HX711 ready; startup tare complete.")
    else:
        zero_noise_threshold_grams = 0.0
        print(
            "HX711 ready; startup tare complete. Calibration is not configured; "
            "only raw sensor values will be uploaded."
        )
    print("Keep the load cell unloaded during startup tare.", flush=True)
    return sensor


def read_sensor(sensor: HX711) -> dict[str, int | float | None]:
    net_samples = [sensor.read() for _ in range(SAMPLE_COUNT)]
    net_raw = statistics.fmean(net_samples)
    raw = round(net_raw + sensor.tare_value_a)

    if CALIBRATION_FACTOR == 0:
        return {
            "raw_value": raw,
            "weight_grams": None,
            "weight_kg": None,
        }

    weight_grams = net_raw / CALIBRATION_FACTOR
    if not math.isfinite(weight_grams):
        raise RuntimeError("HX711 returned a non-finite calibrated weight.")
    if abs(weight_grams) <= zero_noise_threshold_grams:
        weight_grams = 0.0

    return {
        "raw_value": raw,
        "weight_grams": round(weight_grams, 3),
        "weight_kg": round(weight_grams / 1000.0, 6),
    }


def error_detail(error: HTTPError, body: bytes) -> str:
    try:
        payload = json.loads(body.decode("utf-8", "replace"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return f"HTTP {error.code} {error.reason}"
    if isinstance(payload, dict):
        message = payload.get("message") or payload.get("details") or payload.get("hint")
        if isinstance(message, str) and message.strip():
            return f"HTTP {error.code}: {message.strip()[:300]}"
    return f"HTTP {error.code} {error.reason}"


def upload_reading(reading: dict[str, int | float | None]) -> dict[str, Any] | None:
    body = json.dumps({
        "raw_value": reading["raw_value"],
        "weight_grams": reading["weight_grams"],
        "weight_kg": reading["weight_kg"],
    }).encode("utf-8")
    request = Request(
        UPLOAD_URL,
        data=body,
        headers={
            "X-Kusog-Device-Token": DEVICE_TOKEN,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            response_body = response.read()
    except HTTPError as error:
        error_body = error.read()
        if error.code == 409:
            try:
                result = json.loads(error_body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                result = None
            if isinstance(result, dict) and result.get("code") == "no_active_test":
                return None
        raise RuntimeError(
            f"HX711 Edge Function rejected the reading: {error_detail(error, error_body)}"
        ) from error

    try:
        result = json.loads(response_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RuntimeError("HX711 Edge Function returned an invalid response.") from error

    if (
        not isinstance(result, dict)
        or result.get("ok") is not True
        or not isinstance(result.get("reading"), dict)
        or not result["reading"].get("test_record_id")
        or not result["reading"].get("id")
    ):
        raise RuntimeError("HX711 Edge Function returned an unexpected upload response.")
    return result["reading"]

def acquire_single_instance_lock() -> None:
    global uploader_lock_handle
    import fcntl

    uploader_lock_handle = open("/tmp/kusog-hx711-uploader.lock", "w")
    try:
        fcntl.flock(uploader_lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError as error:
        uploader_lock_handle.close()
        uploader_lock_handle = None
        raise RuntimeError("Another HX711 uploader process is already running.") from error


def run() -> None:
    validate_config()
    acquire_single_instance_lock()
    print(
        f"Uploading HX711 readings through {UPLOAD_URL} "
        f"every {UPLOAD_INTERVAL_SECONDS:g}s.",
        flush=True,
    )
    if CALIBRATION_FACTOR == 0:
        print(
            "Weight is uncalibrated: weight_grams, weight_kg, and uplift_force_n "
            "will be stored as NULL.",
            flush=True,
        )
    sensor = None

    while True:
        started = time.monotonic()
        try:
            if sensor is None:
                sensor = connect_sensor()
            reading = read_sensor(sensor)
            inserted = upload_reading(reading)
            if inserted is None:
                print("No test is RUNNING; HX711 reading was not uploaded.", flush=True)
            else:
                print(
                    f"[{inserted.get('recorded_at', datetime.now(timezone.utc).isoformat())}] "
                    f"upload OK: id={inserted.get('id')}, "
                    f"test_record_id={inserted['test_record_id']}, "
                    f"raw={reading['raw_value']}, "
                    f"weight={reading['weight_grams']} g",
                    flush=True,
                )
        except Exception as error:
            print(
                f"[{datetime.now(timezone.utc).isoformat()}] sensor/upload FAILED: {error}",
                flush=True,
            )

        remaining = UPLOAD_INTERVAL_SECONDS - (time.monotonic() - started)
        time.sleep(max(0.0, remaining))


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("HX711 uploader stopped.", flush=True)
