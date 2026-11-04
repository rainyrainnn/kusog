ALTER TABLE public.test_records
  ADD COLUMN IF NOT EXISTS test_mode text,
  ADD COLUMN IF NOT EXISTS actual_weather_status text,
  ADD COLUMN IF NOT EXISTS structural_damage_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'test_records_test_mode_valid'
      AND conrelid = 'public.test_records'::regclass
  ) THEN
    ALTER TABLE public.test_records
      ADD CONSTRAINT test_records_test_mode_valid
      CHECK (test_mode IS NULL OR test_mode IN ('SIMULATION', 'REAL_WORLD_OBSERVATION'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'test_records_weather_status_valid'
      AND conrelid = 'public.test_records'::regclass
  ) THEN
    ALTER TABLE public.test_records
      ADD CONSTRAINT test_records_weather_status_valid
      CHECK (
        actual_weather_status IS NULL
        OR actual_weather_status IN (
          'UNVERIFIED',
          'VERIFIED_TYPHOON',
          'OTHER_WEATHER',
          'NORMAL_CONDITIONS'
        )
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'test_records_structural_damage_status_valid'
      AND conrelid = 'public.test_records'::regclass
  ) THEN
    ALTER TABLE public.test_records
      ADD CONSTRAINT test_records_structural_damage_status_valid
      CHECK (
        structural_damage_status IS NULL
        OR structural_damage_status IN (
          'NOT_ASSESSED',
          'INCONCLUSIVE',
          'NOT_DETECTED',
          'DETECTED'
        )
      )
      NOT VALID;
  END IF;
END;
$$;
