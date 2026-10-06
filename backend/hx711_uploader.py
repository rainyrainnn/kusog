"""Read an HX711 load cell on Raspberry Pi and upload readings to Supabase."""

from __future__ import annotations

import json
import os
import statistics
import time
from datetime import datetime, timezone
from typing import Any
from urllib.request import Request, urlopen

import board
import digitalio
from adafruit_hx711.hx711 import HX711


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
DT_PIN = int(os.getenv("HX711_DT_GPIO", "5"))
SCK_PIN = int(os.getenv("HX711_SCK_GPIO", "6"))
CALIBRATION_FACTOR = float(os.getenv("HX711_CALIBRATION_FACTOR", "0"))
ZERO_THRESHOLD_GRAMS = max(0.0, float(os.getenv("HX711_ZERO_THRESHOLD_GRAMS", "0")))
SAMPLE_COUNT = max(1, int(os.getenv("HX711_SAMPLE_COUNT", "5")))
TARE_SAMPLE_COUNT = max(SAMPLE_COUNT, int(os.getenv("HX711_TARE_SAMPLE_COUNT", "20")))
UPLOAD_INTERVAL_SECONDS = min(2.0, max(0.5, float(os.getenv("HX711_UPLOAD_INTERVAL_SECONDS", "1"))))
GRAVITY_M_S2 = 9.80665
zero_noise_threshold_grams = 0.0


def validate_config() -> None:
    missing = [
        name
        for name, value in (
            ("SUPABASE_URL", SUPABASE_URL),
            ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY),
        )
        if not value
    ]
    if missing:
        raise RuntimeError("Missing environment settings: " + ", ".join(missing))
    if CALIBRATION_FACTOR == 0:
        raise RuntimeError("Set HX711_CALIBRATION_FACTOR from the sensor calibration.")


def connect_sensor() -> HX711:
    global zero_noise_threshold_grams
    data_pin = digitalio.DigitalInOut(getattr(board, f"D{DT_PIN}"))
    data_pin.direction = digitalio.Direction.INPUT
    clock_pin = digitalio.DigitalInOut(getattr(board, f"D{SCK_PIN}"))
    clock_pin.direction = digitalio.Direction.OUTPUT
    sensor = HX711(data_pin, clock_pin)

    tare_samples = [sensor.read() for _ in range(TARE_SAMPLE_COUNT)]
    sensor.tare_value_a = round(statistics.fmean(tare_samples))
    measured_noise_grams = 3 * statistics.pstdev(tare_samples) / abs(CALIBRATION_FACTOR)
    zero_noise_threshold_grams = max(ZERO_THRESHOLD_GRAMS, measured_noise_grams)
    print("HX711 ready; startup tare complete. Keep the load cell unloaded during startup.")
    return sensor


def read_sensor(sensor: HX711) -> dict[str, Any]:
    net_samples = [sensor.read() for _ in range(SAMPLE_COUNT)]
    net_raw = statistics.fmean(net_samples)
    raw = net_raw + sensor.tare_value_a
    weight_grams = net_raw / CALIBRATION_FACTOR
    if abs(weight_grams) <= zero_noise_threshold_grams:
        weight_grams = 0.0

    weight_kg = weight_grams / 1000.0
    return {
        "raw_value": round(float(raw)),
        "weight_grams": round(weight_grams, 3),
        "weight_kg": round(weight_kg, 6),
        "uplift_force_n": round(weight_kg * GRAVITY_M_S2, 6),
    }


def upload_reading(reading: dict[str, Any]) -> None:
    body = json.dumps(reading).encode("utf-8")
    request = Request(
        f"{SUPABASE_URL}/rest/v1/load_cell_readings",
        data=body,
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="POST",
    )
    with urlopen(request, timeout=10) as response:
        response.read()


def run() -> None:
    validate_config()
    print(f"Uploading HX711 readings to {SUPABASE_URL}/load_cell_readings every {UPLOAD_INTERVAL_SECONDS}s")
    sensor = None

    while True:
        started = time.monotonic()
        try:
            if sensor is None:
                sensor = connect_sensor()
            reading = read_sensor(sensor)
            upload_reading(reading)
            print(
                f"[{datetime.now(timezone.utc).isoformat()}] upload OK: "
                f"raw={reading['raw_value']}, weight={reading['weight_grams']} g, "
                f"force={reading['uplift_force_n']} N"
            )
        except Exception as error:
            print(f"[{datetime.now(timezone.utc).isoformat()}] sensor/upload FAILED: {error}")

        remaining = UPLOAD_INTERVAL_SECONDS - (time.monotonic() - started)
        time.sleep(max(0.0, remaining))


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("HX711 uploader stopped.")