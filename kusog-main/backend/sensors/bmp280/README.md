# BMP280 Temperature and Pressure Sensor

**Owner:** Member 3

`bmp280_supabase_uploader.py` reads the existing I2C sensor and uploads
temperature and pressure through the existing `bmp280-upload` Supabase Edge
Function. Preserve its reading format, upload method, and validation.

## Run and test

From the project root, read and upload one reading with the configured Python
environment and BMP280 hardware available:

```text
python -m backend.sensors.bmp280.bmp280_supabase_uploader --once
```

The deployed BMP280 service continues to use the compatibility entry point
`backend/bmp280_supabase_uploader.py`. Coordinate physical-device checks with
the main integrator; the Python unit tests below stub I2C hardware and mock
HTTP.

Use `bmp280_supabase_uploader.env.example` as the variable-name reference.
Keep populated environment files on the Pi.
The existing variable names are `BMP280_UPLOAD_URL`, `BMP280_DEVICE_TOKEN`,
and `BMP280_UPLOAD_INTERVAL_SECONDS`.

Run the isolated unit tests from the project root:

```text
python -m unittest backend.sensors.bmp280.tests.test_bmp280_uploader -v
```

The tests stub I2C hardware and mock HTTP. The deployed BMP280 systemd unit
still starts `backend/bmp280_supabase_uploader.py`; that legacy path is
retained as a compatibility entry point.

## Existing Supabase contract

The uploader posts `temperature_c` and `pressure_hpa` to the existing
`bmp280-upload` Edge Function at the configured `BMP280_UPLOAD_URL`. The
function calls the existing `kusog_insert_bmp280_reading` RPC with
`p_temperature_c` and `p_pressure_hpa`, and associates readings with the
active test.

The persisted table is `bmp280_readings`, with the existing fields `id`,
`operator_id`, `test_record_id`, `temperature_c`, `pressure_hpa`, and
`recorded_at`. Preserve these contracts and the existing Edge Function upload
method.
