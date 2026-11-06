# Load Cell (HX711)

**Owner:** Member 3

`hx711_uploader.py` reads the existing HX711 hardware and uploads through the
existing `hx711-upload` Supabase Edge Function. Preserve its payload fields,
device-token method, calibration behavior, and error handling.

## Run and test

From the project root, start the existing continuous uploader with the
configured Python environment and HX711 hardware available:

```text
python -m backend.sensors.load_cell.hx711_uploader
```

Stop an interactive run with Ctrl+C. Coordinate physical-device checks with
the main integrator; the Python unit tests below stub hardware and mock HTTP.

Use `hx711_supabase_uploader.env.example` as the variable-name reference. Do
not commit populated environment files.
The existing variable names are `HX711_UPLOAD_URL`, `HX711_DEVICE_TOKEN`,
`HX711_DT_GPIO`, `HX711_SCK_GPIO`, `HX711_ZERO_THRESHOLD_GRAMS`,
`HX711_SAMPLE_COUNT`, `HX711_TARE_SAMPLE_COUNT`, and
`HX711_UPLOAD_INTERVAL_SECONDS`.

Run the isolated unit tests from the project root:

```text
python -m unittest backend.sensors.load_cell.tests.test_hx711_uploader -v
```

The tests stub the hardware modules and mock HTTP. No HX711 systemd unit is
currently included in this repository.

## Existing Supabase contract

The uploader posts to the existing `hx711-upload` Edge Function at the
configured `HX711_UPLOAD_URL`. Its JSON reading fields are `raw_value`,
`weight_grams`, and `weight_kg`; the Edge Function calls the existing
`kusog_insert_load_cell_reading_for_active_test` RPC with `p_raw_value`,
`p_weight_grams`, and `p_weight_kg`.

The persisted table is `load_cell_readings`, with the existing fields `id`,
`operator_id`, `test_record_id`, `raw_value`, `weight_grams`, `weight_kg`,
`uplift_force_n`, and `recorded_at`. The Edge Function associates the reading
with the active test. Preserve these contracts and the existing Edge Function
upload method.
