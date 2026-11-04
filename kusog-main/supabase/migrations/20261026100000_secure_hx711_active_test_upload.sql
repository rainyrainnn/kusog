CREATE OR REPLACE FUNCTION public.kusog_insert_load_cell_reading_for_active_test(
  p_raw_value bigint,
  p_weight_grams numeric,
  p_weight_kg numeric
) RETURNS TABLE (
  id bigint,
  test_record_id uuid,
  recorded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  active_test_id uuid;
BEGIN
  IF p_raw_value IS NULL THEN
    RAISE EXCEPTION 'HX711 raw value is required.';
  END IF;
  IF (p_weight_grams IS NULL) <> (p_weight_kg IS NULL) THEN
    RAISE EXCEPTION 'Calibrated grams and kilograms must both be provided or both be NULL.';
  END IF;
  IF p_weight_grams IS NOT NULL
    AND abs((p_weight_grams / 1000) - p_weight_kg) > 0.000001 THEN
    RAISE EXCEPTION 'HX711 grams and kilograms do not agree.';
  END IF;

  SELECT tests.id
    INTO active_test_id
  FROM public.test_records AS tests
  WHERE tests.status = 'RUNNING'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.load_cell_readings (
    raw_value,
    weight_grams,
    weight_kg,
    uplift_force_n,
    test_record_id
  ) VALUES (
    p_raw_value,
    p_weight_grams,
    p_weight_kg,
    CASE WHEN p_weight_kg IS NULL THEN NULL ELSE p_weight_kg * 9.80665 END,
    active_test_id
  )
  RETURNING load_cell_readings.id,
    load_cell_readings.test_record_id,
    load_cell_readings.recorded_at;
END;
$$;

REVOKE ALL ON FUNCTION public.kusog_insert_load_cell_reading_for_active_test(bigint, numeric, numeric)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kusog_insert_load_cell_reading_for_active_test(bigint, numeric, numeric)
  TO service_role;

NOTIFY pgrst, 'reload schema';
