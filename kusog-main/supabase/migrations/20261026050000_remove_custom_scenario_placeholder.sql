UPDATE public.test_records
SET scenario = 'Unclassified'
WHERE scenario = 'Custom Scenario';

ALTER TABLE public.test_records
  ALTER COLUMN scenario SET DEFAULT 'Unclassified';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'test_records_scenario_not_custom_placeholder'
      AND conrelid = 'public.test_records'::regclass
  ) THEN
    ALTER TABLE public.test_records
      ADD CONSTRAINT test_records_scenario_not_custom_placeholder
      CHECK (scenario <> 'Custom Scenario');
  END IF;
END;
$$;
