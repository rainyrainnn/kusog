"""Read a DHT11 sensor on Raspberry Pi BCM GPIO4 and upload real readings."""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import adafruit_dht
import board


SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_ANON_KEY = os.getenv("VITE_SUPABASE_ANON_KEY", "").strip()
try:
    UPLOAD_INTERVAL_SECONDS = int(os.getenv("DHT11_UPLOAD_INTERVAL_SECONDS", "10"))
except ValueError as error:
    raise RuntimeError("DHT11_UPLOAD_INTERVAL_SECONDS must be a whole number.") from error


def validate_config() -> None:
    missing = [
        name
        for name, value in (
            ("VITE_SUPABASE_URL", SUPABASE_URL),
            ("VITE_SUPABASE_ANON_KEY", SUPABASE_ANON_KEY),
        )
        if not value
    ]
    if missing:
        raise RuntimeError("Missing environment settings: " + ", ".join(missing))
    if not SUPABASE_URL.startswith("https://"):
        raise RuntimeError("SUPABASE_URL must use HTTPS.")
    if UPLOAD_INTERVAL_SECONDS < 10:
        raise RuntimeError("DHT11_UPLOAD_INTERVAL_SECONDS must be at least 10.")


def read_sensor(sensor: adafruit_dht.DHT11) -> dict[str, float]:
    temperature = sensor.temperature
    humidity = sensor.humidity
    if temperature is None or humidity is None:
        raise RuntimeError("DHT11 returned an incomplete reading.")

    temperature_c = float(temperature)
    humidity_percent = float(humidity)
    if (
        not math.isfinite(temperature_c)
        or not math.isfinite(humidity_percent)
        or not 0 <= temperature_c <= 50
        or not 0 <= humidity_percent <= 100
    ):
        raise RuntimeError(
            f"DHT11 returned out-of-range values: "
            f"temperature={temperature_c}, humidity={humidity_percent}"
        )

    return {
        "temperature_c": temperature_c,
        "humidity_percent": humidity_percent,
    }


def upload_reading(reading: dict[str, float]) -> None:
    body = json.dumps(reading, allow_nan=False).encode("utf-8")
    request = Request(
        f"{SUPABASE_URL}/rest/v1/dht11_readings",
        data=body,
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="POST",
    )
    with urlopen(request, timeout=10) as response:
        response.read()


def error_detail(error: Exception) -> str:
    if not isinstance(error, HTTPError):
        return ""
    detail = error.read().decode("utf-8", "replace").strip()
    return f": {detail}" if detail else ""


def log_failure(message: str, error: Exception) -> None:
    print(
        f"[{datetime.now(timezone.utc).isoformat()}] {message}: "
        f"{error}{error_detail(error)}",
        file=sys.stderr,
        flush=True,
    )


def upload_once(sensor: adafruit_dht.DHT11) -> None:
    reading = read_sensor(sensor)
    upload_reading(reading)
    print(
        f"[{datetime.now(timezone.utc).isoformat()}] upload OK: "
        f"temperature={reading['temperature_c']:.1f} C, "
        f"humidity={reading['humidity_percent']:.1f}%",
        flush=True,
    )


def run(once: bool = False) -> None:
    validate_config()
    sensor = adafruit_dht.DHT11(board.D4, use_pulseio=False)
    print(
        f"DHT11 uploader started on BCM GPIO4; uploading to "
        f"{SUPABASE_URL}/dht11_readings every {UPLOAD_INTERVAL_SECONDS}s.",
        flush=True,
    )

    try:
        while True:
            started = time.monotonic()
            try:
                upload_once(sensor)
            except (HTTPError, URLError, TimeoutError) as error:
                if once:
                    raise
                log_failure("Supabase upload failed", error)
            except (RuntimeError, OSError, ValueError) as error:
                if once:
                    raise
                log_failure("DHT11 read failed; no row uploaded", error)

            if once:
                return
            time.sleep(max(0.0, UPLOAD_INTERVAL_SECONDS - (time.monotonic() - started)))
    finally:
        sensor.exit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--once",
        action="store_true",
        help="read the physical sensor once and upload one valid reading",
    )
    args = parser.parse_args()
    try:
        run(once=args.once)
    except KeyboardInterrupt:
        print("DHT11 uploader stopped.", flush=True)
    except (RuntimeError, OSError, HTTPError, URLError, TimeoutError) as error:
        log_failure("DHT11 uploader could not start", error)
        raise SystemExit(1) from error
