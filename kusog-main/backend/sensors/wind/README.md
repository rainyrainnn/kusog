# Wind Sensor

**Owner:** Member 2

`wind_sensor_uploader.py` reads the existing Modbus/RS-485 sensor and uploads
the current wind speed and direction through the existing Supabase REST/RPC
method. Preserve the current reading format and field names.

## Run and test

From the project root, start the existing continuous uploader with the
configured Python environment and RS-485 device available:

```text
python -m backend.sensors.wind.wind_sensor_uploader
```

Stop an interactive run with Ctrl+C. Coordinate physical-device checks with
the main integrator; the Python unit tests below mock Modbus and HTTP.

Use `wind_sensor_uploader.env.example` as the variable-name reference. Keep
actual hardware and Supabase settings in the existing Pi environment, not in
the repository.
The existing variable names are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`WIND_RS485_PORT`, `WIND_MODBUS_BAUDRATE`, `WIND_MODBUS_SLAVE_ID`,
`WIND_REGISTER_TYPE`, `WIND_SPEED_REGISTER`, `WIND_DIRECTION_REGISTER`,
`WIND_SPEED_FORMAT`, `WIND_DIRECTION_FORMAT`, `WIND_SPEED_SCALE_MPS`,
`WIND_DIRECTION_SCALE_DEG`, `WIND_MODBUS_PARITY`, `WIND_MODBUS_STOPBITS`,
`WIND_MODBUS_BYTE_SIZE`, `WIND_WORD_ORDER`, `WIND_SERIAL_TIMEOUT_SECONDS`,
and `WIND_UPLOAD_INTERVAL_SECONDS`.

Run the isolated unit tests from the project root:

```text
python -m unittest backend.sensors.wind.tests.test_wind_sensor_uploader -v
```

The tests mock Modbus and HTTP. No Wind systemd unit is currently included in
this repository.

## Existing Supabase contract

The uploader looks up the active record in `test_records` using `id` and
`status`, then calls the existing `kusog_insert_wind_sensor_reading` RPC with
`p_test_record_id`, `p_wind_speed`, and `p_wind_direction`.

The persisted table is `wind_sensor_readings`, with the existing fields `id`,
`operator_id`, `test_record_id`, `wind_speed`, `wind_direction`, and
`recorded_at`. These names and the existing direct Supabase REST/RPC
connection method must not be changed by sensor work.
