import json
import sys
import types
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit


def install_hardware_import_stubs() -> None:
    board = types.ModuleType("board")
    board.I2C = lambda: types.SimpleNamespace(deinit=lambda: None)
    bmp280 = types.ModuleType("adafruit_bmp280")

    class AdafruitBMP280I2C:
        def __init__(self, _i2c, address):
            self.address = address
            self.temperature = 22.5
            self.pressure = 1008.2

    bmp280.Adafruit_BMP280_I2C = AdafruitBMP280I2C
    with patch.dict(sys.modules, {"board": board, "adafruit_bmp280": bmp280}):
        from backend import bmp280_supabase_uploader

    globals()["bmp280_supabase_uploader"] = bmp280_supabase_uploader


install_hardware_import_stubs()


class BMP280UploaderTests(unittest.TestCase):
    def test_reads_real_sensor_properties_and_validates_ranges(self) -> None:
        sensor = types.SimpleNamespace(temperature=22.5, pressure=1008.2)

        reading = bmp280_supabase_uploader.read_sensor(sensor)

        self.assertEqual(reading, {"temperature_c": 22.5, "pressure_hpa": 1008.2})
        self.assertNotIn("humidity", reading)

    @patch.object(bmp280_supabase_uploader, "upload_reading", return_value={
        "id": 8,
        "test_record_id": None,
        "recorded_at": "2026-11-04T00:00:00+00:00",
    })
    @patch.object(bmp280_supabase_uploader, "read_sensor", return_value={
        "temperature_c": 22.5,
        "pressure_hpa": 1008.2,
    })
    def test_upload_once_continues_without_a_running_test(self, mock_read_sensor, mock_upload) -> None:
        self.assertTrue(bmp280_supabase_uploader.upload_once(object()))
        mock_read_sensor.assert_called_once()
        mock_upload.assert_called_once_with({"temperature_c": 22.5, "pressure_hpa": 1008.2})

    def test_rejects_invalid_sensor_values(self) -> None:
        for sensor in (
            types.SimpleNamespace(temperature=float("nan"), pressure=1000),
            types.SimpleNamespace(temperature=20, pressure=1200),
        ):
            with self.subTest(sensor=sensor), self.assertRaises(RuntimeError):
                bmp280_supabase_uploader.read_sensor(sensor)

    @patch.object(bmp280_supabase_uploader, "urlopen")
    def test_upload_inserts_without_active_test_and_uses_device_token(self, mock_urlopen) -> None:
        mock_urlopen.return_value.__enter__.return_value.read.return_value = json.dumps({
            "ok": True,
            "reading": {
                "id": 8,
                "test_record_id": None,
                "recorded_at": "2026-11-04T00:00:00+00:00",
            },
        }).encode()
        with (
            patch.object(bmp280_supabase_uploader, "UPLOAD_URL", "https://project.test/functions/v1/bmp280-upload"),
            patch.object(bmp280_supabase_uploader, "DEVICE_TOKEN", "b" * 32),
        ):
            reading = bmp280_supabase_uploader.upload_reading({"temperature_c": 22.5, "pressure_hpa": 1008.2})

        request = mock_urlopen.call_args.args[0]
        self.assertEqual(urlsplit(request.full_url).path, "/functions/v1/bmp280-upload")
        self.assertEqual(json.loads(request.data), {
            "temperature_c": 22.5,
            "pressure_hpa": 1008.2,
        })
        self.assertNotIn("humidity", json.loads(request.data))
        self.assertIsNone(reading["test_record_id"])
        self.assertEqual(request.get_header("X-kusog-device-token"), "b" * 32)
        self.assertNotIn("Authorization", request.headers)

    @patch.object(bmp280_supabase_uploader, "urlopen")
    def test_edge_function_associates_reading_with_active_test(self, mock_urlopen) -> None:
        test_id = "12345678-1234-4234-8234-123456789abc"
        mock_urlopen.return_value.__enter__.return_value.read.return_value = json.dumps({
            "ok": True,
            "reading": {
                "id": 9,
                "test_record_id": test_id,
                "recorded_at": "2026-11-04T00:00:05+00:00",
            },
        }).encode()
        with patch.object(
            bmp280_supabase_uploader,
            "UPLOAD_URL",
            "https://project.test/functions/v1/bmp280-upload",
        ):
            result = bmp280_supabase_uploader.upload_reading({"temperature_c": 22.5, "pressure_hpa": 1008.2})

        self.assertEqual(result["test_record_id"], test_id)


if __name__ == "__main__":
    unittest.main()
