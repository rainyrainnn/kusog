/*
# Create house_models and test_records tables

1. New Tables
- `house_models`: Stores configurable house model definitions for chamber tests.
  - id (uuid PK)
  - name (text, unique) — e.g. "Model A", "Model B"
  - description (text, nullable)
  - image_url (text, nullable) — URL to associated house model photo
  - is_active (boolean, default true) — can be deactivated without deletion
  - default_wall_material (text, nullable) — suggested default material
  - default_roof_material (text, nullable)
  - default_floor_material (text, nullable)
  - created_at (timestamptz)

- `test_records`: Stores completed test experiment records with house/material info.
  - id (uuid PK)
  - test_id (text, unique) — human-readable ID like "KUSOG-2026-0918-001"
  - scenario (text) — test scenario name
  - start_time (timestamptz) — when test started
  - end_time (timestamptz, nullable) — when test stopped
  - duration_seconds (integer) — total elapsed seconds
  - status (text) — 'RUNNING', 'COMPLETED', 'STOPPED'
  - house_model_id (uuid, nullable, FK to house_models)
  - house_model_name (text, nullable) — snapshot of model name at test time
  - house_model_image_url (text, nullable) — snapshot of model image URL
  - wall_material (text, nullable)
  - roof_material (text, nullable)
  - floor_material (text, nullable)
  - other_materials (text, nullable)
  - wind_speed (real, default 0) — final wind speed reading km/h
  - temperature (real, default 0)
  - humidity (real, default 0)
  - pressure (real, default 0)
  - current_force (real, default 0) — base uplift force N
  - ai_confidence (integer, default 0)
  - ai_roof (text, default 'NORMAL')
  - ai_movement (text, default 'NORMAL')
  - ai_cracks (text, default 'NONE')
  - ai_overall (text, default 'STANDBY')
  - fan_speed (integer, default 0)
  - rain_level (text, actual Tuya rain sensor value)
  - wind_direction (integer, default 0)
  - camera_status (text, default 'disconnected')
  - camera_stream_url (text, nullable)
  - log_entries (jsonb, nullable) — array of log entries
  - created_at (timestamptz)

2. Security
- Enable RLS on both tables.
- This app uses a demo auth flow (no Supabase auth session in the main App.tsx).
  Policies allow anon + authenticated full CRUD since the app is single-operator.
- house_models: anon+authenticated can CRUD (shared config data)
- test_records: anon+authenticated can CRUD (shared test data)

3. Indexes
- test_records.test_id (unique index for fast lookup)
- test_records.created_at (descending for history listing)
- test_records.house_model_id (for model-based queries)
*/

CREATE TABLE IF NOT EXISTS house_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  default_wall_material text,
  default_roof_material text,
  default_floor_material text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE house_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_house_models" ON house_models;
CREATE POLICY "anon_select_house_models" ON house_models FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_house_models" ON house_models;
CREATE POLICY "anon_insert_house_models" ON house_models FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_house_models" ON house_models;
CREATE POLICY "anon_update_house_models" ON house_models FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_house_models" ON house_models;
CREATE POLICY "anon_delete_house_models" ON house_models FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS test_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id text UNIQUE NOT NULL,
  scenario text NOT NULL DEFAULT 'Custom Scenario',
  start_time timestamptz,
  end_time timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'COMPLETED',
  house_model_id uuid REFERENCES house_models(id) ON DELETE SET NULL,
  house_model_name text,
  house_model_image_url text,
  wall_material text,
  roof_material text,
  floor_material text,
  other_materials text,
  wind_speed real DEFAULT 0,
  temperature real DEFAULT 0,
  humidity real DEFAULT 0,
  pressure real DEFAULT 0,
  current_force real DEFAULT 0,
  ai_confidence integer DEFAULT 0,
  ai_roof text DEFAULT 'NORMAL',
  ai_movement text DEFAULT 'NORMAL',
  ai_cracks text DEFAULT 'NONE',
  ai_overall text DEFAULT 'STANDBY',
  fan_speed integer DEFAULT 0,
  rain_level text,
  wind_direction integer DEFAULT 0,
  camera_status text DEFAULT 'disconnected',
  camera_stream_url text,
  log_entries jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE test_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_test_records" ON test_records;
CREATE POLICY "anon_select_test_records" ON test_records FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_test_records" ON test_records;
CREATE POLICY "anon_insert_test_records" ON test_records FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_test_records" ON test_records;
CREATE POLICY "anon_update_test_records" ON test_records FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_test_records" ON test_records;
CREATE POLICY "anon_delete_test_records" ON test_records FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_test_records_created_at ON test_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_records_house_model_id ON test_records (house_model_id);

-- Seed default house models
INSERT INTO house_models (name, description) VALUES
  ('Model A', 'Standard concrete house model with corrugated metal roof'),
  ('Model B', 'CHB block house model with galvanized iron roof'),
  ('Model C', 'Wooden frame house model with metal sheet roof')
ON CONFLICT (name) DO NOTHING;
