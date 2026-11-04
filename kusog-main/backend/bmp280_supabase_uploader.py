"""Read a physical BMP280 on I2C and upload readings to the KUSOG Edge Function."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import socket
import sys
import time
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

import adafruit_bmp280
import board


UPLOAD_URL = os.getenv("BMP280_UPLOAD_URL", "").strip()
DEVICE_TOKEN = os.getenv("BMP280_DEVICE_TOKEN", "").strip()
I2C_ADDRESS = 0x76
try:
    UPLOAD_INTERVAL_SECONDS = float(os.getenv("BMP280_UPLOAD_INTERVAL_SECONDS", "5"))
except ValueError as error:
    raise RuntimeError("BMP280_UPLOAD_INTERVAL_SECONDS must be a number.") from error


def validate_config() -> None:
    missing = [
        name
        for name, value in (
            ("BMP280_UPLOAD_URL", UPLOAD_URL),
            ("BMP280_DEVICE_TOKEN", DEVICE_TOKEN),
        )
        if not value
    ]
    if missing:
        raise RuntimeError("Missing environment settings: " + ", ".join(missing))

    endpoint = urlsplit(UPLOAD_URL)
    if endpoint.scheme != "https" or not endpoint.netloc:
        raise RuntimeError("BMP280_UPLOAD_URL must be a valid HTTPS URL.")
    if len(DEVICE_TOKEN.encode("utf-8")) < 32:
        raise RuntimeError("BMP280_DEVICE_TOKEN must be at least 32 bytes.")
    if not math.isfinite(UPLOAD_INTERVAL_SECONDS) or not 1 <= UPLOAD_INTERVAL_SECONDS <= 60:
        raise RuntimeError("BMP280_UPLOAD_INTERVAL_SECONDS must be between 1 and 60.")


def connect_sensor() -> tuple[adafruit_bmp280.Adafruit_BMP280_I2C, Any]:
    i2c = board.I2C()
    try:
        sensor = adafruit_bmp280.Adafruit_BMP280_I2C(i2c, address=I2C_ADDRESS)
    except Exception:
        i2c.deinit()
        raise
    return sensor, i2c


def read_sensor(sensor: adafruit_bmp280.Adafruit_BMP280_I2C) -> dict[str, float]:
    try:
        temperature_c = float(sensor.temperature)
        pressure_hpa = float(sensor.pressure)
    except (TypeError, ValueError) as error:
        raise RuntimeError("BMP280 returned a non-numeric temperature or pressure.") from error
    if not math.isfinite(temperature_c) or not -40 <= temperature_c <= 85:
        raise RuntimeError(f"BMP280 returned an out-of-range temperature: {temperature_c}.")
    if not math.isfinite(pressure_hpa) or not 300 <= pressure_hpa <= 1100:
        raise RuntimeError(f"BMP280 returned an out-of-range pressure: {pressure_hpa}.")
    return {"temperature_c": temperature_c, "pressure_hpa": pressure_hpa}


def _request(method: str, body: dict[str, Any] | None = None) -> Request:
    data = None if body is None else json.dumps(body, allow_nan=False).encode("utf-8")
    headers = {
        "X-Kusog-Device-Token": DEVICE_TOKEN,
        "Accept": "application/json",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    return Request(UPLOAD_URL, data=data, headers=headers, method=method)


def upload_reading(reading: dict[str, float]) -> dict[str, Any]:
    request = _request("POST", {
        "temperature_c": reading["temperature_c"],
        "pressure_hpa": reading["pressure_hpa"],
    })
    with urlopen(request, timeout=10) as response:
        response_body = response.read()

    try:
        result = json.loads(response_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RuntimeError("BMP280 Edge Function returned invalid upload JSON.") from error
    if (
        not isinstance(result, dict)
        or result.get("ok") is not True
        or not isinstance(result.get("reading"), dict)
        or not result["reading"].get("id")
        or not isinstance(result["reading"].get("recorded_at"), str)
        or (
            result["reading"].get("test_record_id") is not None
            and (
                not isinstance(result["reading"].get("test_record_id"), str)
                or not re.fullmatch(
                    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
                    result["reading"]["test_record_id"],
                )
            )
        )
    ):
        raise RuntimeError("BMP280 Edge Function returned an unexpected upload response.")
    return result["reading"]


def upload_once(sensor: adafruit_bmp280.Adafruit_BMP280_I2C) -> bool:
    reading = read_sensor(sensor)
    inserted = upload_reading(reading)

    print(
        f"[{inserted['recorded_at']}] BMP280 upload OK: "
        f"test_record_id={inserted['test_record_id'] or 'none'}, "
        f"temperature={reading['temperature_c']:.2f} C, "
        f"pressure={reading['pressure_hpa']:.2f} hPa",
        flush=True,
    )
    return True


def run(once: bool = False) -> None:
    validate_config()
    sensor = None
    i2c = None
    print(
        f"BMP280 uploader started on {socket.gethostname()} at I2C 0x{I2C_ADDRESS:02X}; "
        f"uploading physical readings through {UPLOAD_URL} every {UPLOAD_INTERVAL_SECONDS:g}s.",
        flush=True,
    )
    try:
        while True:
            started = time.monotonic()
            try:
                if sensor is None:
                    sensor, i2c = connect_sensor()
                    print(
                        f"BMP280 connected at I2C 0x{I2C_ADDRESS:02X}; "
                        "the Adafruit driver verified the sensor chip ID.",
                        flush=True,
                    )
                upload_once(sensor)
            except (HTTPError, URLError, TimeoutError, RuntimeError, OSError, ValueError) as error:
                if once:
                    raise
                print(
                    f"[{datetime.now(timezone.utc).isoformat()}] "
                    f"BMP280 read/upload FAILED: {error}",
                    file=sys.stderr,
                    flush=True,
                )
                if i2c is not None:
                    i2c.deinit()
                    sensor = None
                    i2c = None
            if once:
                return
            time.sleep(max(0.0, UPLOAD_INTERVAL_SECONDS - (time.monotonic() - started)))
    finally:
        if i2c is not None:
            i2c.deinit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="read the physical sensor and upload one reading")
    args = parser.parse_args()
    try:
        run(once=args.once)
    except KeyboardInterrupt:
        print("BMP280 uploader stopped.", flush=True)
    except (RuntimeError, OSError, HTTPError, URLError, TimeoutError) as error:
        print(f"BMP280 uploader could not start: {error}", file=sys.stderr, flush=True)
        raise SystemExit(1) from error
