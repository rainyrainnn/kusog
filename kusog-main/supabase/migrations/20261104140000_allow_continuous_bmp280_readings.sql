ALTER TABLE public.bmp280_readings
  ADD COLUMN IF NOT EXISTS test_record_id uuid
  REFERENCES public.test_records(id) ON DELETE RESTRICT;

ALTER TABLE public.bmp280_readings
  ALTER COLUMN test_record_id DROP NOT NULL;

DROP POLICY IF EXISTS bmp280_readings_select_unassociated ON public.bmp280_readings;
CREATE POLICY bmp280_readings_select_unassociated ON public.bmp280_readings
  FOR SELECT TO authenticated
  USING (test_record_id IS NULL);

DROP FUNCTION IF EXISTS public.kusog_insert_bmp280_active_reading(uuid, double precision, double precision);

CREATE OR REPLACE FUNCTION public.kusog_insert_bmp280_reading(
  p_temperature_c double precision,
  p_pressure_hpa double precision
) RETURNS TABLE (
  id bigint,
  test_record_id uuid,
  recorded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  active_test RECORD;
  active_test_count integer := 0;
  session_test_id uuid;
  session_operator_id uuid;
BEGIN
  IF p_temperature_c IS NULL OR p_temperature_c < -40 OR p_temperature_c > 85
    OR p_pressure_hpa IS NULL OR p_pressure_hpa < 300 OR p_pressure_hpa > 1100 THEN
    RAISE EXCEPTION 'BMP280 reading is invalid or outside the accepted range.';
  END IF;

  FOR active_test IN
    SELECT tests.id, tests.operator_id
    FROM public.test_records AS tests
    WHERE tests.status = 'RUNNING'
    ORDER BY tests.start_time DESC
    LIMIT 2
    FOR UPDATE
  LOOP
    active_test_count := active_test_count + 1;
    IF active_test_count > 1 THEN
      RAISE EXCEPTION 'More than one test session is marked RUNNING.';
    END IF;
    session_test_id := active_test.id;
    session_operator_id := active_test.operator_id;
  END LOOP;

  RETURN QUERY
  INSERT INTO public.bmp280_readings (
    operator_id,
    test_record_id,
    temperature_c,
    pressure_hpa
  ) VALUES (
    session_operator_id,
    session_test_id,
    p_temperature_c,
    p_pressure_hpa
  )
  RETURNING bmp280_readings.id,
    bmp280_readings.test_record_id,
    bmp280_readings.recorded_at;
END;
$$;

REVOKE ALL ON FUNCTION public.kusog_insert_bmp280_reading(double precision, double precision)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kusog_insert_bmp280_reading(double precision, double precision)
  TO service_role;

NOTIFY pgrst, 'reload schema';
