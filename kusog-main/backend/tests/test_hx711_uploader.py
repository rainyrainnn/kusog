import json
import sys
import types
import unittest
from contextlib import ExitStack
from io import BytesIO
from urllib.error import HTTPError
from unittest.mock import patch


def install_hardware_import_stubs() -> None:
    board = types.ModuleType("board")
    board.D5 = object()
    board.D6 = object()
    digitalio = types.ModuleType("digitalio")

    class DigitalInOut:
        def __init__(self, pin):
            self.pin = pin
            self.direction = None

    class Direction:
        INPUT = "input"
        OUTPUT = "output"

    digitalio.DigitalInOut = DigitalInOut
    digitalio.Direction = Direction
    adafruit_hx711 = types.ModuleType("adafruit_hx711")
    hx711_module = types.ModuleType("adafruit_hx711.hx711")

    class HX711:
        pass

    hx711_module.HX711 = HX711
    with patch.dict(sys.modules, {
        "board": board,
        "digitalio": digitalio,
        "adafruit_hx711": adafruit_hx711,
        "adafruit_hx711.hx711": hx711_module,
    }):
        from backend import hx711_uploader

    globals()["hx711_uploader"] = hx711_uploader


install_hardware_import_stubs()


class HX711UploaderTests(unittest.TestCase):
    def test_uncalibrated_reading_keeps_raw_value_and_omits_weight(self) -> None:
        sensor = types.SimpleNamespace(read=iter([105, 107, 106]).__next__, tare_value_a=100)
        with patch.object(hx711_uploader, "SAMPLE_COUNT", 3), patch.object(
            hx711_uploader, "CALIBRATION_FACTOR", 0
        ):
            reading = hx711_uploader.read_sensor(sensor)

        self.assertEqual(reading, {
            "raw_value": 206,
            "weight_grams": None,
            "weight_kg": None,
        })

    def test_calibrated_reading_calculates_weight_from_sensor_samples(self) -> None:
        sensor = types.SimpleNamespace(read=iter([10, 10, 10]).__next__, tare_value_a=100)
        with (
            patch.object(hx711_uploader, "SAMPLE_COUNT", 3),
            patch.object(hx711_uploader, "CALIBRATION_FACTOR", 2),
            patch.object(hx711_uploader, "zero_noise_threshold_grams", 0),
        ):
            reading = hx711_uploader.read_sensor(sensor)

        self.assertEqual(reading, {
            "raw_value": 110,
            "weight_grams": 5,
            "weight_kg": 0.005,
        })

    @patch.object(hx711_uploader, "urlopen")
    def test_upload_posts_to_edge_function_with_device_token(self, mock_urlopen) -> None:
        response = mock_urlopen.return_value.__enter__.return_value
        response.read.return_value = json.dumps({
            "ok": True,
            "reading": {
                "id": 4,
                "test_record_id": "running-test",
                "recorded_at": "2026-10-26T03:00:00+00:00",
            },
        }).encode()
        reading = {
            "raw_value": 210,
            "weight_grams": 5,
            "weight_kg": 0.005,
        }

        with ExitStack() as stack:
            stack.enter_context(patch.object(
                hx711_uploader,
                "UPLOAD_URL",
                "https://project.test/functions/v1/hx711-upload",
            ))
            stack.enter_context(patch.object(hx711_uploader, "DEVICE_TOKEN", "d" * 32))
            result = hx711_uploader.upload_reading(reading)

        request = mock_urlopen.call_args.args[0]
        self.assertEqual(
            request.full_url,
            "https://project.test/functions/v1/hx711-upload",
        )
        self.assertEqual(json.loads(request.data), {
            "raw_value": 210,
            "weight_grams": 5,
            "weight_kg": 0.005,
        })
        self.assertEqual(request.get_header("X-kusog-device-token"), "d" * 32)
        self.assertNotIn("Authorization", request.headers)
        self.assertEqual(result["test_record_id"], "running-test")
        self.assertEqual(mock_urlopen.call_args.kwargs["timeout"], 10)

    @patch.object(hx711_uploader, "urlopen")
    def test_upload_returns_none_when_server_finds_no_running_test(self, mock_urlopen) -> None:
        mock_urlopen.side_effect = HTTPError(
            "https://project.test/functions/v1/hx711-upload",
            409,
            "Conflict",
            {},
            BytesIO(b'{"code":"no_active_test","message":"No test is RUNNING."}'),
        )
        with (
            patch.object(
                hx711_uploader,
                "UPLOAD_URL",
                "https://project.test/functions/v1/hx711-upload",
            ),
            patch.object(hx711_uploader, "DEVICE_TOKEN", "d" * 32),
        ):
            result = hx711_uploader.upload_reading({
                "raw_value": 210,
                "weight_grams": None,
                "weight_kg": None,
            })

        self.assertIsNone(result)

    @patch.object(hx711_uploader, "urlopen")
    def test_upload_does_not_report_success_on_unexpected_response(self, mock_urlopen) -> None:
        mock_urlopen.return_value.__enter__.return_value.read.return_value = b'{"ok":true}'
        with (
            patch.object(
                hx711_uploader,
                "UPLOAD_URL",
                "https://project.test/functions/v1/hx711-upload",
            ),
            patch.object(hx711_uploader, "DEVICE_TOKEN", "d" * 32),
            self.assertRaisesRegex(RuntimeError, "unexpected upload response"),
        ):
            hx711_uploader.upload_reading({
                "raw_value": 210,
                "weight_grams": None,
                "weight_kg": None,
            })


if __name__ == "__main__":
    unittest.main()
