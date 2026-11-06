import json
import unittest
from contextlib import redirect_stdout
from io import BytesIO, StringIO
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

from backend import rain_sensor_uploader


class RainSensorUploaderTests(unittest.TestCase):
    def test_upload_interval_is_limited_to_five_seconds(self) -> None:
        self.assertEqual(rain_sensor_uploader.upload_interval_seconds("30"), 5)
        self.assertEqual(rain_sensor_uploader.upload_interval_seconds("5"), 5)
        self.assertEqual(rain_sensor_uploader.upload_interval_seconds("1"), 1)
        self.assertEqual(rain_sensor_uploader.upload_interval_seconds(None), 5)
        self.assertEqual(rain_sensor_uploader.upload_interval_seconds("invalid"), 5)

    def test_parse_api_reading_uses_real_sensor_fields(self) -> None:
        reading = rain_sensor_uploader.parse_api_reading({
            "connected": True,
            "sensor": {
                "rain_level": "heavy",
                "rain_state": "raining",
                "rain_24h": "12.5",
                "battery_percentage": 87,
            },
        })

        self.assertEqual(reading, {
            "rain_level": "heavy",
            "rain_state": "raining",
            "rain_24h": 12.5,
            "battery_percentage": 87,
        })

    def test_parse_api_reading_rejects_disconnected_sensor(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "disconnected"):
            rain_sensor_uploader.parse_api_reading({
                "connected": False,
                "error": "sensor unavailable",
            })

    def test_parse_api_reading_rejects_missing_required_fields(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "rain_level or rain_state"):
            rain_sensor_uploader.parse_api_reading({
                "connected": True,
                "sensor": {"rain_state": "raining"},
            })

    def test_parse_api_reading_rejects_invalid_optional_measurements(self) -> None:
        for field, value in (("rain_24h", -1), ("battery_percentage", 101), ("rain_24h", "not-a-number")):
            with self.subTest(field=field, value=value):
                with self.assertRaisesRegex(RuntimeError, "invalid|out-of-range"):
                    rain_sensor_uploader.parse_api_reading({
                        "connected": True,
                        "sensor": {
                            "rain_level": "heavy",
                            "rain_state": "raining",
                            field: value,
                        },
                    })

    @patch.object(rain_sensor_uploader, "urlopen")
    def test_active_test_lookup_requires_running_status(self, mock_urlopen) -> None:
        response = mock_urlopen.return_value.__enter__.return_value
        response.read.return_value = b'[{"id":"active-record"}]'
        with (
            patch.object(rain_sensor_uploader, "SUPABASE_URL", "https://project.supabase.co"),
            patch.object(rain_sensor_uploader, "SUPABASE_SERVICE_ROLE_KEY", "test-key"),
        ):
            record_id = rain_sensor_uploader.get_active_test_id()

        request = mock_urlopen.call_args.args[0]
        query = parse_qs(urlsplit(request.full_url).query)
        self.assertEqual(record_id, "active-record")
        self.assertEqual(query["status"], ["eq.RUNNING"])
        self.assertEqual(query["limit"], ["2"])
        self.assertEqual(request.get_header("Authorization"), "Bearer test-key")
        self.assertEqual(request.get_header("Apikey"), "test-key")

    @patch.object(rain_sensor_uploader, "get_active_test_id", return_value=None)
    @patch.object(rain_sensor_uploader, "fetch_reading")
    def test_cycle_without_active_test_does_not_read_or_upload(self, mock_fetch, _mock_test_id) -> None:
        with patch.object(rain_sensor_uploader, "upload_reading") as mock_upload:
            uploaded = rain_sensor_uploader.upload_active_test_once()

        self.assertFalse(uploaded)
        mock_fetch.assert_not_called()
        mock_upload.assert_not_called()

    @patch.object(rain_sensor_uploader, "get_active_test_id", return_value="active-record")
    @patch.object(rain_sensor_uploader, "fetch_reading", return_value={
        "rain_level": "heavy",
        "rain_state": "raining",
        "rain_24h": 12.5,
        "battery_percentage": 87,
    })
    def test_cycle_uploads_once_to_the_single_active_test(self, mock_fetch, _mock_test_id) -> None:
        with patch.object(rain_sensor_uploader, "upload_reading") as mock_upload:
            uploaded = rain_sensor_uploader.upload_active_test_once()

        self.assertTrue(uploaded)
        mock_fetch.assert_called_once_with()
        mock_upload.assert_called_once_with("active-record", mock_fetch.return_value)

    @patch.object(rain_sensor_uploader, "urlopen")
    def test_upload_uses_expected_rpc_arguments(self, mock_urlopen) -> None:
        response = mock_urlopen.return_value.__enter__.return_value
        response.read.return_value = b""
        reading = {
            "rain_level": "heavy",
            "rain_state": "raining",
            "rain_24h": 12.5,
            "battery_percentage": 87,
        }

        with (
            patch.object(rain_sensor_uploader, "SUPABASE_URL", "https://project.supabase.co"),
            patch.object(rain_sensor_uploader, "SUPABASE_SERVICE_ROLE_KEY", "test-key"),
        ):
            rain_sensor_uploader.upload_reading("record-id", reading)

        request = mock_urlopen.call_args.args[0]
        self.assertTrue(request.full_url.endswith("/rpc/kusog_insert_rain_sensor_reading"))
        self.assertEqual(json.loads(request.data), {
            "p_test_record_id": "record-id",
            "p_rain_level": "heavy",
            "p_rain_state": "raining",
            "p_rain_24h": 12.5,
            "p_battery_percentage": 87,
        })
        self.assertEqual(request.get_header("Authorization"), "Bearer test-key")
        self.assertEqual(request.get_header("Apikey"), "test-key")
        self.assertNotIn("recorded_at", json.loads(request.data))
        self.assertEqual(mock_urlopen.call_args.kwargs["timeout"], 10)

    @patch.object(rain_sensor_uploader, "fetch_reading", return_value={
        "rain_level": "heavy",
        "rain_state": "raining",
        "rain_24h": 12.5,
        "battery_percentage": 87,
    })
    @patch.object(rain_sensor_uploader, "upload_reading", side_effect=RuntimeError("RPC rejected the reading"))
    def test_failed_database_write_never_logs_success(self, _mock_upload, _mock_fetch) -> None:
        output = StringIO()
        with redirect_stdout(output), self.assertRaisesRegex(RuntimeError, "RPC rejected"):
            rain_sensor_uploader.upload_once("record-id")
        self.assertNotIn("upload OK", output.getvalue())

    def test_error_detail_redacts_service_key_and_bearer_tokens(self) -> None:
        previous_key = rain_sensor_uploader.SUPABASE_SERVICE_ROLE_KEY
        rain_sensor_uploader.SUPABASE_SERVICE_ROLE_KEY = "test-service-secret"
        try:
            body = json.dumps({
                "message": "token Bearer sensitive-token",
                "details": "test-service-secret",
            }).encode()
            error = HTTPError("https://example.test", 401, "Unauthorized", {}, BytesIO(body))

            detail = rain_sensor_uploader.error_detail(error)

            self.assertNotIn("test-service-secret", detail)
            self.assertNotIn("sensitive-token", detail)
            self.assertIn("[redacted]", detail)
        finally:
            rain_sensor_uploader.SUPABASE_SERVICE_ROLE_KEY = previous_key


if __name__ == "__main__":
    unittest.main()
