"""Read the Raspberry Pi rain API and upload active-test readings to Supabase."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


RAIN_API_URL = os.getenv(
    "KUSOG_RAIN_API_URL",
    "http://127.0.0.1:5001/api/rain",
).strip()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()


def upload_interval_seconds(value: str | None) -> int:
    try:
        return min(5, max(1, int(value or "5")))
    except ValueError:
        return 5


POLL_INTERVAL_SECONDS = upload_interval_seconds(os.getenv("RAIN_UPLOAD_INTERVAL_SECONDS"))


def required_config() -> None:
    missing = [
        name
        for name, value in (
            ("KUSOG_RAIN_API_URL", RAIN_API_URL),
            ("SUPABASE_URL", SUPABASE_URL),
            ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY),
        )
        if not value
    ]
    if missing:
        raise RuntimeError("Missing environment settings: " + ", ".join(missing))


def optional_sensor_number(value: Any, field: str) -> int | float | None:
    if value is None:
        return None
    if isinstance(value, bool) or str(value).strip() == "":
        raise RuntimeError(f"Rain API returned an invalid {field} value.")
    try:
        parsed = float(value)
    except (TypeError, ValueError) as error:
        raise RuntimeError(f"Rain API returned an invalid {field} value.") from error
    if not math.isfinite(parsed) or parsed < 0:
        raise RuntimeError(f"Rain API returned an invalid {field} value.")
    return int(parsed) if parsed.is_integer() else parsed


def parse_api_reading(result: Any) -> dict[str, Any]:
    if not isinstance(result, dict):
        raise RuntimeError("Rain API returned an invalid response.")
    if result.get("connected") is not True:
        detail = result.get("error")
        if isinstance(detail, str) and detail.strip():
            raise RuntimeError(
                "Rain API reports the sensor disconnected: "
                f"{sanitize_error_text(detail.strip())[:300]}"
            )
        raise RuntimeError("Rain API reports the sensor disconnected.")

    sensor = result.get("sensor")
    if not isinstance(sensor, dict):
        raise RuntimeError("Rain API response is missing its sensor object.")

    rain_level = sensor.get("rain_level")
    rain_state = sensor.get("rain_state")
    if (
        not isinstance(rain_level, (str, int, float))
        or isinstance(rain_level, bool)
        or not str(rain_level).strip()
        or not isinstance(rain_state, str)
        or not rain_state.strip()
    ):
        raise RuntimeError("Rain API response is missing rain_level or rain_state.")
    rain_24h = optional_sensor_number(sensor.get("rain_24h"), "rain_24h")
    battery_percentage = optional_sensor_number(sensor.get("battery_percentage"), "battery_percentage")
    if battery_percentage is not None and battery_percentage > 100:
        raise RuntimeError("Rain API returned an out-of-range battery_percentage value.")
    return {
        "rain_level": str(rain_level),
        "rain_state": rain_state,
        "rain_24h": rain_24h,
        "battery_percentage": battery_percentage,
    }


def fetch_reading() -> dict[str, Any]:
    request = Request(RAIN_API_URL, headers={"Accept": "application/json"})
    with urlopen(request, timeout=10) as response:
        try:
            result = json.loads(response.read().decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RuntimeError("Rain API did not return valid JSON.") from error
    return parse_api_reading(result)


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


def upload_active_test_once() -> bool:
    test_record_id = get_active_test_id()
    if test_record_id is None:
        return False
    upload_once(test_record_id)
    return True


def error_detail(error: Exception) -> str:
    if not isinstance(error, HTTPError):
        return ""
    detail = error.read().decode("utf-8", "replace").strip()
    if not detail:
        return ""
    try:
        payload = json.loads(detail)
    except json.JSONDecodeError:
        payload = None
    if isinstance(payload, dict):
        detail = " ".join(
            str(payload[key]).strip()
            for key in ("message", "details", "hint", "code")
            if payload.get(key) is not None
        )
    for secret in (SUPABASE_SERVICE_ROLE_KEY,):
        if secret:
            detail = detail.replace(secret, "[redacted]")
    detail = re.sub(r"(?i)bearer\s+\S+", "Bearer [redacted]", detail)
    detail = re.sub(r"(?i)(apikey|authorization)\s*[:=]\s*\S+", r"\1=[redacted]", detail)
    detail = re.sub(r"[\r\n\t]+", " ", detail).strip()
    return f": {detail[:500]}" if detail else ""


def sanitize_error_text(value: str) -> str:
    if SUPABASE_SERVICE_ROLE_KEY:
        value = value.replace(SUPABASE_SERVICE_ROLE_KEY, "[redacted]")
    value = re.sub(r"(?i)bearer\s+\S+", "Bearer [redacted]", value)
    value = re.sub(r"(?i)(apikey|authorization)\s*[:=]\s*\S+", r"\1=[redacted]", value)
    return re.sub(r"[\r\n\t]+", " ", value).strip()


def run() -> None:
    required_config()
    print("Rain uploader started; reading the configured local rain API.", flush=True)
    print(
        f"Uploading to the Supabase rain RPC every {POLL_INTERVAL_SECONDS}s",
        flush=True,
    )

    while True:
        try:
            if not upload_active_test_once():
                print(
                    f"[{datetime.now(timezone.utc).isoformat()}] "
                    "no active test; skipping rain sensor read.",
                    flush=True,
                )
        except (HTTPError, URLError, TimeoutError, RuntimeError, OSError) as error:
            print(
                f"[{datetime.now(timezone.utc).isoformat()}] upload FAILED: "
                f"{sanitize_error_text(str(error))}{error_detail(error)}",
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
            if not upload_active_test_once():
                print("No active test session; no sensor reading or upload performed.", flush=True)
        else:
            run()
    except KeyboardInterrupt:
        print("Rain sensor uploader stopped.", flush=True)
    except (HTTPError, URLError, TimeoutError, RuntimeError, OSError) as error:
        print(
            f"Rain sensor uploader failed: "
            f"{sanitize_error_text(str(error))}{error_detail(error)}",
            file=sys.stderr,
            flush=True,
        )
        raise SystemExit(1) from error
