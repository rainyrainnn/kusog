CREATE UNIQUE INDEX IF NOT EXISTS idx_test_records_single_running
  ON public.test_records (status)
  WHERE status = 'RUNNING';

ALTER TABLE public.load_cell_readings
  ADD COLUMN IF NOT EXISTS test_record_id uuid;

ALTER TABLE public.wind_sensor_readings
  ADD COLUMN IF NOT EXISTS test_record_id uuid;

ALTER TABLE public.dht11_readings
  ADD COLUMN IF NOT EXISTS test_record_id uuid;

ALTER TABLE IF EXISTS public.rain_sensor_readings
  ADD COLUMN IF NOT EXISTS test_record_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'load_cell_test_record_id_fkey'
      AND conrelid = 'public.load_cell_readings'::regclass
  ) THEN
    ALTER TABLE public.load_cell_readings
      ADD CONSTRAINT load_cell_test_record_id_fkey
      FOREIGN KEY (test_record_id) REFERENCES public.test_records(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wind_sensor_test_record_id_fkey'
      AND conrelid = 'public.wind_sensor_readings'::regclass
  ) THEN
    ALTER TABLE public.wind_sensor_readings
      ADD CONSTRAINT wind_sensor_test_record_id_fkey
      FOREIGN KEY (test_record_id) REFERENCES public.test_records(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dht11_test_record_id_fkey'
      AND conrelid = 'public.dht11_readings'::regclass
  ) THEN
    ALTER TABLE public.dht11_readings
      ADD CONSTRAINT dht11_test_record_id_fkey
      FOREIGN KEY (test_record_id) REFERENCES public.test_records(id) ON DELETE RESTRICT;
  END IF;
  IF to_regclass('public.rain_sensor_readings') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'rain_sensor_test_record_id_fkey'
        AND conrelid = 'public.rain_sensor_readings'::regclass
    ) THEN
    ALTER TABLE public.rain_sensor_readings
      ADD CONSTRAINT rain_sensor_test_record_id_fkey
      FOREIGN KEY (test_record_id) REFERENCES public.test_records(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_load_cell_readings_test_record
  ON public.load_cell_readings (test_record_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_wind_sensor_readings_test_record
  ON public.wind_sensor_readings (test_record_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_dht11_readings_test_record
  ON public.dht11_readings (test_record_id, recorded_at DESC);

DO $$
BEGIN
  IF to_regclass('public.rain_sensor_readings') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rain_sensor_readings_test_record ON public.rain_sensor_readings (test_record_id, recorded_at DESC)';
    EXECUTE 'REVOKE INSERT ON TABLE public.rain_sensor_readings FROM PUBLIC, anon, authenticated, service_role';
    IF to_regclass('public.rain_sensor_readings_id_seq') IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON SEQUENCE public.rain_sensor_readings_id_seq FROM anon, authenticated, service_role';
    END IF;
  END IF;
END;
$$;

REVOKE INSERT ON TABLE public.load_cell_readings FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT ON TABLE public.wind_sensor_readings FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT ON TABLE public.dht11_readings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.load_cell_readings_id_seq FROM anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.wind_sensor_readings_id_seq FROM anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.dht11_readings_id_seq FROM anon, authenticated, service_role;

DROP POLICY IF EXISTS "dht11_readings_insert_sensor" ON public.dht11_readings;
DROP POLICY IF EXISTS "dht11_readings_insert_active_test" ON public.dht11_readings;

CREATE OR REPLACE FUNCTION public.kusog_insert_dht11_reading(
  p_test_record_id uuid,
  p_temperature_c double precision,
  p_humidity_percent double precision
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM id FROM public.test_records
  WHERE id = p_test_record_id AND status = 'RUNNING'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test session is no longer active.';
  END IF;
  IF p_temperature_c IS NULL OR p_temperature_c < 0 OR p_temperature_c > 50
    OR p_humidity_percent IS NULL OR p_humidity_percent < 0 OR p_humidity_percent > 100 THEN
    RAISE EXCEPTION 'DHT11 reading is outside the accepted range.';
  END IF;

  INSERT INTO public.dht11_readings (test_record_id, temperature_c, humidity_percent)
  VALUES (p_test_record_id, p_temperature_c, p_humidity_percent);
END;
$$;

CREATE OR REPLACE FUNCTION public.kusog_insert_load_cell_reading(
  p_test_record_id uuid,
  p_raw_value bigint,
  p_weight_grams numeric,
  p_weight_kg numeric,
  p_uplift_force_n numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM id FROM public.test_records
  WHERE id = p_test_record_id AND status = 'RUNNING'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test session is no longer active.';
  END IF;

  INSERT INTO public.load_cell_readings (
    test_record_id, raw_value, weight_grams, weight_kg, uplift_force_n
  ) VALUES (
    p_test_record_id, p_raw_value, p_weight_grams, p_weight_kg, p_uplift_force_n
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.kusog_insert_wind_sensor_reading(
  p_test_record_id uuid,
  p_wind_speed numeric,
  p_wind_direction numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM id FROM public.test_records
  WHERE id = p_test_record_id AND status = 'RUNNING'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test session is no longer active.';
  END IF;
  IF p_wind_speed IS NULL OR p_wind_speed < 0
    OR p_wind_direction IS NULL OR p_wind_direction < 0 OR p_wind_direction >= 360 THEN
    RAISE EXCEPTION 'Wind reading is outside the accepted range.';
  END IF;

  INSERT INTO public.wind_sensor_readings (
    test_record_id, wind_speed, wind_direction
  ) VALUES (
    p_test_record_id, p_wind_speed, p_wind_direction
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.kusog_insert_rain_sensor_reading(
  p_test_record_id uuid,
  p_rain_level text,
  p_rain_state text,
  p_rain_24h numeric,
  p_battery_percentage numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM id FROM public.test_records
  WHERE id = p_test_record_id AND status = 'RUNNING'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test session is no longer active.';
  END IF;

  EXECUTE '
    INSERT INTO public.rain_sensor_readings (
      test_record_id, rain_level, rain_state, rain_24h, battery_percentage
    ) VALUES ($1, $2, $3, $4, $5)
  ' USING p_test_record_id, p_rain_level, p_rain_state, p_rain_24h,
    CASE WHEN p_battery_percentage IS NULL THEN NULL ELSE round(p_battery_percentage)::integer END;
END;
$$;

REVOKE ALL ON FUNCTION public.kusog_insert_dht11_reading(uuid, double precision, double precision) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kusog_insert_load_cell_reading(uuid, bigint, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kusog_insert_wind_sensor_reading(uuid, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kusog_insert_rain_sensor_reading(uuid, text, text, numeric, numeric) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.kusog_insert_dht11_reading(uuid, double precision, double precision) TO service_role;
GRANT EXECUTE ON FUNCTION public.kusog_insert_load_cell_reading(uuid, bigint, numeric, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.kusog_insert_wind_sensor_reading(uuid, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.kusog_insert_rain_sensor_reading(uuid, text, text, numeric, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
