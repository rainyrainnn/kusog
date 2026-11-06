# Rain Sensor

**Owner:** Member 1

`rain_sensor_uploader.py` reads the existing Raspberry Pi rain API and uploads
the current reading to the existing Supabase RPC. Keep the existing payload
fields, RPC arguments, authentication method, and sampling behavior unchanged.

## Run and test

From the project root, run one reading with the existing configured Python
environment:

```text
python -m backend.sensors.rain.rain_sensor_uploader --once
```

For the deployed service, the existing
`backend/kusog-rain-uploader.service` continues to use the compatibility entry
point `backend/rain_sensor_uploader.py`. Coordinate live-device checks with
the main integrator.

Copy `rain_sensor_uploader.env.example` to the Pi's existing environment-file
location and set its values there. Do not commit populated environment files.
The existing variable names are `KUSOG_RAIN_API_URL`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `RAIN_UPLOAD_INTERVAL_SECONDS`.
The existing frontend rain endpoint setting is `VITE_KUSOG_RAIN_URL`; the
development proxy can also use `VITE_KUSOG_PI_HOST` and
`VITE_KUSOG_EDGE_URL`.

Run the isolated unit tests from the project root:

```text
python -m unittest backend.sensors.rain.tests.test_rain_sensor_uploader -v
```

The tests mock HTTP and do not require the Pi or Supabase. The deployed Rain
systemd unit still starts `backend/rain_sensor_uploader.py`; that legacy path
is retained as a compatibility entry point.

## Existing Supabase contract

The uploader looks up the active record in `test_records` using `id` and
`status`, then calls the existing
`kusog_insert_rain_sensor_reading` RPC. Its RPC argument names are
`p_test_record_id`, `p_rain_level`, `p_rain_state`, `p_rain_24h`, and
`p_battery_percentage`.

The persisted table is `rain_sensor_readings`, with the existing fields `id`,
`operator_id`, `test_record_id`, `rain_level`, `rain_state`, `rain_24h`,
`battery_percentage`, and `recorded_at`. These names and the existing direct
Supabase REST/RPC connection method must not be changed by sensor work.
