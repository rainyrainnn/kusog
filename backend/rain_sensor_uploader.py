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
from urllib.parse import urlencode
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


def get_active_test_id() -> str | None:
    query = urlencode({"select": "id", "status": "eq.RUNNING", "limit": "2"})
    lookup = Request(
        f"{SUPABASE_URL}/rest/v1/test_records?{query}",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        },
        method="GET",
    )
    with urlopen(lookup, timeout=10) as response:
        active_tests = json.loads(response.read().decode("utf-8"))
    if not active_tests:
        return None
    if len(active_tests) != 1:
        raise RuntimeError("More than one test session is marked RUNNING.")
    return str(active_tests[0]["id"])


def upload_reading(test_record_id: str, reading: dict[str, Any]) -> None:
    body = json.dumps({
        "p_test_record_id": test_record_id,
        "p_rain_level": reading["rain_level"],
        "p_rain_state": reading["rain_state"],
        "p_rain_24h": reading["rain_24h"],
        "p_battery_percentage": reading["battery_percentage"],
    }).encode("utf-8")
    request = Request(
        f"{SUPABASE_URL}/rest/v1/rpc/kusog_insert_rain_sensor_reading",
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


def upload_once(test_record_id: str) -> None:
    reading = fetch_reading()
    upload_reading(test_record_id, reading)
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
            test_record_id = get_active_test_id()
            if test_record_id:
                upload_once(test_record_id)
            else:
                print(
                    f"[{datetime.now(timezone.utc).isoformat()}] "
                    "no active test; skipping rain sensor read.",
                    flush=True,
                )
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
            active_test_id = get_active_test_id()
            if active_test_id:
                upload_once(active_test_id)
            else:
                print("No active test session; no sensor reading or upload performed.", flush=True)
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
