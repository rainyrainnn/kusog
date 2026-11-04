ALTER TABLE test_records
  ADD COLUMN IF NOT EXISTS rain_level_raw text,
  ADD COLUMN IF NOT EXISTS rain_state text,
  ADD COLUMN IF NOT EXISTS rain_24h real,
  ADD COLUMN IF NOT EXISTS rain_battery integer,
  ADD COLUMN IF NOT EXISTS rain_sensor_connected boolean;