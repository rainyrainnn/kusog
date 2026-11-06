ALTER TABLE public.bmp280_readings
  ADD COLUMN IF NOT EXISTS test_record_id uuid
  REFERENCES public.test_records(id) ON DELETE RESTRICT;

ALTER TABLE public.bmp280_readings
  ALTER COLUMN test_record_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bmp280_readings_test_record
  ON public.bmp280_readings (test_record_id, recorded_at DESC, id DESC);

NOTIFY pgrst, 'reload schema';
