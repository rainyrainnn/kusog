import json
import sys
import types
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit


modbus_module = types.ModuleType("pymodbus")
modbus_client_module = types.ModuleType("pymodbus.client")
modbus_client_module.ModbusSerialClient = object
modbus_module.client = modbus_client_module
sys.modules.setdefault("pymodbus", modbus_module)
sys.modules.setdefault("pymodbus.client", modbus_client_module)

from backend import wind_sensor_uploader


class WindSensorUploaderTests(unittest.TestCase):
    @patch.object(wind_sensor_uploader, "urlopen")
    def test_active_test_lookup_uses_bearer_auth(self, mock_urlopen) -> None:
        response = mock_urlopen.return_value.__enter__.return_value
        response.read.return_value = b'[{"id":"active-record"}]'
        with (
            patch.object(wind_sensor_uploader, "SUPABASE_URL", "https://project.supabase.co"),
            patch.object(wind_sensor_uploader, "SUPABASE_SERVICE_ROLE_KEY", "test-key"),
        ):
            record_id = wind_sensor_uploader.get_active_test_id()

        request = mock_urlopen.call_args.args[0]
        query = parse_qs(urlsplit(request.full_url).query)
        self.assertEqual(record_id, "active-record")
        self.assertEqual(query["status"], ["eq.RUNNING"])
        self.assertEqual(request.get_header("Authorization"), "Bearer test-key")
        self.assertEqual(request.get_header("Apikey"), "test-key")

    @patch.object(wind_sensor_uploader, "urlopen")
    def test_upload_uses_bearer_auth_and_active_test_rpc(self, mock_urlopen) -> None:
        response = mock_urlopen.return_value.__enter__.return_value
        response.read.return_value = b""
        reading = {"wind_speed": 5.2, "wind_direction": 180.0}
        with (
            patch.object(wind_sensor_uploader, "SUPABASE_URL", "https://project.supabase.co"),
            patch.object(wind_sensor_uploader, "SUPABASE_SERVICE_ROLE_KEY", "test-key"),
        ):
            wind_sensor_uploader.upload_reading("record-id", reading)

        request = mock_urlopen.call_args.args[0]
        self.assertTrue(request.full_url.endswith("/rpc/kusog_insert_wind_sensor_reading"))
        self.assertEqual(json.loads(request.data), {
            "p_test_record_id": "record-id",
            "p_wind_speed": 5.2,
            "p_wind_direction": 180.0,
        })
        self.assertEqual(request.get_header("Authorization"), "Bearer test-key")
        self.assertEqual(request.get_header("Apikey"), "test-key")


if __name__ == "__main__":
    unittest.main()
