"""Read the Tuya rain sensor script on Raspberry Pi and upload to Supabase."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


RAIN_SENSOR_SCRIPT = os.path.expanduser(
    os.getenv("KUSOG_RAIN_SENSOR_SCRIPT", "~/test_rain_sensor.py").strip()
)
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
try:
    POLL_INTERVAL_SECONDS = max(10, int(os.getenv("RAIN_UPLOAD_INTERVAL_SECONDS", "30")))
except ValueError:
    POLL_INTERVAL_SECONDS = 30


def required_config() -> None:
    missing = [
        name
        for name, value in (
            ("KUSOG_RAIN_SENSOR_SCRIPT", RAIN_SENSOR_SCRIPT),
            ("SUPABASE_URL", SUPABASE_URL),
            ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY),
        )
        if not value
    ]
    if missing:
        raise RuntimeError("Missing environment settings: " + ", ".join(missing))
    if not os.path.isfile(RAIN_SENSOR_SCRIPT):
        raise RuntimeError(f"Rain sensor script was not found: {RAIN_SENSOR_SCRIPT}")


def number_or_none(value: Any) -> int | float | None:
    if value is None or isinstance(value, bool) or str(value).strip() == "":
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return int(parsed) if parsed.is_integer() else parsed


def fetch_reading() -> dict[str, Any]:
    try:
        completed = subprocess.run(
            [sys.executable, RAIN_SENSOR_SCRIPT],
            check=True,
            capture_output=True,
            text=True,
            timeout=15,
        )
    except subprocess.CalledProcessError as error:
        detail = error.stderr.strip() or f"exit status {error.returncode}"
        raise RuntimeError(f"Rain sensor script failed: {detail}") from error
    except subprocess.TimeoutExpired as error:
        raise RuntimeError("Rain sensor script timed out after 15 seconds.") from error

    try:
        result = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError("Rain sensor script did not return valid JSON.") from error
    if not isinstance(result, dict) or result.get("success") is not True:
        raise RuntimeError("Tuya rain sensor script reports unavailable data.")

    attributes = result.get("result")
    if not isinstance(attributes, list):
        raise RuntimeError("Tuya rain sensor response does not contain a result list.")
    values = {
        item.get("code"): item.get("value")
        for item in attributes
        if isinstance(item, dict) and isinstance(item.get("code"), str)
    }
    rain_level = values.get("rain_level")
    rain_state = values.get("rain_state")
    if rain_level is None or not isinstance(rain_state, str) or not rain_state:
        raise RuntimeError("Tuya rain sensor response is missing rain_level or rain_state.")

    return {
        "rain_level": str(rain_level),
        "rain_state": rain_state,
        "rain_24h": number_or_none(values.get("rain_24h")),
        "battery_percentage": number_or_none(values.get("battery_percentage")),
    }


def upload_reading(reading: dict[str, Any]) -> None:
    body = json.dumps(reading).encode("utf-8")
    request = Request(
        f"{SUPABASE_URL}/rest/v1/rain_sensor_readings",
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


def upload_once() -> None:
    reading = fetch_reading()
    upload_reading(reading)
    print(
        f"[{datetime.now(timezone.utc).isoformat()}] upload OK: "
        f"state={reading['rain_state']}, level={reading['rain_level']}, "
        f"rain_24h={reading['rain_24h']}, battery={reading['battery_percentage']}",
        flush=True,
    )


def error_detail(error: Exception) -> str:
    if not isinstance(error, HTTPError):
        return ""
    detail = error.read().decode("utf-8", "replace").strip()
    return f": {detail}" if detail else ""


def run() -> None:
    required_config()
    print(f"Rain uploader started; reading {RAIN_SENSOR_SCRIPT}", flush=True)
    print(
        f"Uploading to {SUPABASE_URL}/rain_sensor_readings every {POLL_INTERVAL_SECONDS}s",
        flush=True,
    )

    while True:
        try:
            upload_once()
        except (HTTPError, URLError, TimeoutError, RuntimeError, OSError) as error:
            print(
                f"[{datetime.now(timezone.utc).isoformat()}] upload FAILED: "
                f"{error}{error_detail(error)}",
                flush=True,
            )
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--once",
        action="store_true",
        help="read the real sensor once and upload one row, then exit",
    )
    args = parser.parse_args()
    try:
        if args.once:
            required_config()
            upload_once()
        else:
            run()
    except KeyboardInterrupt:
        print("Rain sensor uploader stopped.", flush=True)
    except (HTTPError, URLError, TimeoutError, RuntimeError, OSError) as error:
        print(
            f"Rain sensor uploader failed: {error}{error_detail(error)}",
            file=sys.stderr,
            flush=True,
        )
        raise SystemExit(1) from error
