"""Read-only UMini-WS RS485/Modbus reader and Supabase uploader.

The UMini-WS is a sensing device only. This program only reads wind
measurements; it sends no control or actuator commands to the sensor.
"""

from __future__ import annotations

import json
import os
import struct
import time
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pymodbus.client import ModbusSerialClient


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
RS485_PORT = os.getenv("WIND_RS485_PORT", "").strip()
MODBUS_BAUDRATE = os.getenv("WIND_MODBUS_BAUDRATE", "").strip()
MODBUS_SLAVE_ID = os.getenv("WIND_MODBUS_SLAVE_ID", "").strip()
REGISTER_TYPE = os.getenv("WIND_REGISTER_TYPE", "").strip().lower()
SPEED_REGISTER = os.getenv("WIND_SPEED_REGISTER", "").strip()
DIRECTION_REGISTER = os.getenv("WIND_DIRECTION_REGISTER", "").strip()
SPEED_FORMAT = os.getenv("WIND_SPEED_FORMAT", "").strip().lower()
DIRECTION_FORMAT = os.getenv("WIND_DIRECTION_FORMAT", "").strip().lower()
SPEED_SCALE = os.getenv("WIND_SPEED_SCALE_MPS", "").strip()
DIRECTION_SCALE = os.getenv("WIND_DIRECTION_SCALE_DEG", "").strip()
WORD_ORDER = os.getenv("WIND_WORD_ORDER", "big").strip().lower()
PARITY = os.getenv("WIND_MODBUS_PARITY", "N").strip().upper()
STOPBITS = int(os.getenv("WIND_MODBUS_STOPBITS", "1"))
BYTE_SIZE = int(os.getenv("WIND_MODBUS_BYTE_SIZE", "8"))
SERIAL_TIMEOUT = float(os.getenv("WIND_SERIAL_TIMEOUT_SECONDS", "2"))
UPLOAD_INTERVAL = min(2.0, max(0.5, float(os.getenv("WIND_UPLOAD_INTERVAL_SECONDS", "1"))))

REGISTER_FORMATS = {"u16": (1, ">H"), "s16": (1, ">h"), "u32": (2, ">I"), "s32": (2, ">i"), "f32": (2, ">f")}


def validate_config() -> dict[str, Any]:
    missing = [
        name
        for name, value in (
            ("SUPABASE_URL", SUPABASE_URL),
            ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY),
            ("WIND_RS485_PORT", RS485_PORT),
            ("WIND_MODBUS_BAUDRATE", MODBUS_BAUDRATE),
            ("WIND_MODBUS_SLAVE_ID", MODBUS_SLAVE_ID),
            ("WIND_REGISTER_TYPE", REGISTER_TYPE),
            ("WIND_SPEED_REGISTER", SPEED_REGISTER),
            ("WIND_DIRECTION_REGISTER", DIRECTION_REGISTER),
            ("WIND_SPEED_FORMAT", SPEED_FORMAT),
            ("WIND_DIRECTION_FORMAT", DIRECTION_FORMAT),
            ("WIND_SPEED_SCALE_MPS", SPEED_SCALE),
            ("WIND_DIRECTION_SCALE_DEG", DIRECTION_SCALE),
        )
        if not value
    ]
    if missing:
        raise RuntimeError("Missing environment settings: " + ", ".join(missing))
    if REGISTER_TYPE not in {"holding", "input"}:
        raise RuntimeError("WIND_REGISTER_TYPE must be 'holding' or 'input'.")
    if SPEED_FORMAT not in REGISTER_FORMATS or DIRECTION_FORMAT not in REGISTER_FORMATS:
        raise RuntimeError("Register formats must be u16, s16, u32, s32, or f32.")
    if WORD_ORDER not in {"big", "little"} or PARITY not in {"N", "E", "O"}:
        raise RuntimeError("Set a supported Modbus word order and parity.")

    return {
        "port": RS485_PORT,
        "baudrate": int(MODBUS_BAUDRATE),
        "slave_id": int(MODBUS_SLAVE_ID),
        "speed_register": int(SPEED_REGISTER),
        "direction_register": int(DIRECTION_REGISTER),
        "speed_scale": float(SPEED_SCALE),
        "direction_scale": float(DIRECTION_SCALE),
    }


def decode_registers(registers: list[int], value_format: str) -> float:
    count, struct_format = REGISTER_FORMATS[value_format]
    if len(registers) != count:
        raise RuntimeError(f"Expected {count} Modbus register(s), received {len(registers)}.")
    ordered = registers if WORD_ORDER == "big" else list(reversed(registers))
    packed = b"".join(struct.pack(">H", register) for register in ordered)
    return float(struct.unpack(struct_format, packed)[0])


def read_value(client: ModbusSerialClient, address: int, value_format: str, slave_id: int) -> float:
    count = REGISTER_FORMATS[value_format][0]
    if REGISTER_TYPE == "input":
        response = client.read_input_registers(address=address, count=count, device_id=slave_id)
    else:
        response = client.read_holding_registers(address=address, count=count, device_id=slave_id)
    if response.isError():
        raise RuntimeError(f"Modbus read failed at register {address}: {response}")
    return decode_registers(response.registers, value_format)


def read_wind(client: ModbusSerialClient, config: dict[str, Any]) -> dict[str, float]:
    speed = read_value(client, config["speed_register"], SPEED_FORMAT, config["slave_id"]) * config["speed_scale"]
    direction = read_value(client, config["direction_register"], DIRECTION_FORMAT, config["slave_id"]) * config["direction_scale"]
    if speed < 0 or not 0 <= direction < 360:
        raise RuntimeError(f"Sensor values out of range: speed={speed}, direction={direction}")
    return {"wind_speed": speed, "wind_direction": direction}


def upload_reading(reading: dict[str, float]) -> None:
    body = json.dumps(reading).encode("utf-8")
    request = Request(
        f"{SUPABASE_URL}/rest/v1/wind_sensor_readings",
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


def create_client(config: dict[str, Any]) -> ModbusSerialClient:
    return ModbusSerialClient(
        port=config["port"],
        baudrate=config["baudrate"],
        bytesize=BYTE_SIZE,
        parity=PARITY,
        stopbits=STOPBITS,
        timeout=SERIAL_TIMEOUT,
    )


def run() -> None:
    config = validate_config()
    client: ModbusSerialClient | None = None
    print("UMini-WS read-only wind uploader started; no sensor control commands are sent.")

    while True:
        started = time.monotonic()
        try:
            if client is None:
                client = create_client(config)
                if not client.connect():
                    raise ConnectionError(f"Could not open RS485 port {config['port']}.")

            reading = read_wind(client, config)
            upload_reading(reading)
            print(
                f"[{datetime.now(timezone.utc).isoformat()}] upload OK: "
                f"speed={reading['wind_speed']:.2f} m/s, "
                f"direction={reading['wind_direction']:.1f} deg"
            )
        except Exception as error:
            print(f"[{datetime.now(timezone.utc).isoformat()}] wind read/upload FAILED: {error}")
            if client is not None:
                client.close()
                client = None

        time.sleep(max(0.0, UPLOAD_INTERVAL - (time.monotonic() - started)))


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("Wind sensor uploader stopped.")