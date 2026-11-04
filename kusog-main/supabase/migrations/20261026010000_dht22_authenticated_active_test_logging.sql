ALTER TABLE public.test_records
  ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.kusog_insert_dht22_active_reading(
  p_test_record_id uuid,
  p_temperature_c double precision,
  p_humidity_percent double precision
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  session_operator_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before saving DHT22 readings.';
  END IF;

  SELECT operator_id
    INTO session_operator_id
  FROM public.test_records
  WHERE id = p_test_record_id
    AND status = 'RUNNING'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test session is no longer active.';
  END IF;
  IF session_operator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Test session does not belong to the signed-in user.';
  END IF;
  IF p_temperature_c IS NULL OR p_temperature_c < 0 OR p_temperature_c > 50
    OR p_humidity_percent IS NULL OR p_humidity_percent < 0 OR p_humidity_percent > 100 THEN
    RAISE EXCEPTION 'DHT22 reading is outside the accepted range.';
  END IF;

  INSERT INTO public.dht11_readings (test_record_id, temperature_c, humidity_percent)
  VALUES (p_test_record_id, p_temperature_c, p_humidity_percent);
END;
$$;

REVOKE ALL ON FUNCTION public.kusog_insert_dht22_active_reading(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kusog_insert_dht22_active_reading(uuid, double precision, double precision) TO authenticated;

NOTIFY pgrst, 'reload schema';
