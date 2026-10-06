/*
 * Test record service — all Supabase reads/writes for test_records go here.
 * When real hardware is connected, sensor readings flow in through this same
 * interface; only the data source changes, not the save/fetch shape.
 */

import { supabase } from './supabase';
import type { LogEntry } from '@/hooks/useSimulation';

export type TestRecord = {
  id: string;
  test_id: string;
  scenario: string;
  start_time: string | null;
  end_time: string | null;
  duration_seconds: number;
  status: string;
  // house
  house_model_id: string | null;
  house_model_name: string | null;
  house_model_image_url: string | null;
  wall_material: string | null;
  roof_material: string | null;
  floor_material: string | null;
  other_materials: string | null;
  // telemetry snapshot
  wind_speed: number;
  temperature: number;
  humidity: number;
  pressure: number;
  current_force: number;
  ai_confidence: number;
  ai_roof: string;
  ai_movement: string;
  ai_cracks: string;
  ai_overall: string;
  // controls snapshot
  fan_speed: number;
  rain_level: string;
  rain_level_raw: string | null;
  rain_state: string | null;
  rain_24h: number | null;
  rain_battery: number | null;
  rain_sensor_connected: boolean | null;
  wind_direction: number;
  // camera
  camera_status: string;
  camera_stream_url: string | null;
  // misc
  log_entries: LogEntry[] | null;
  created_at: string;
};

export type SaveTestPayload = Omit<TestRecord, 'id' | 'created_at'>;

export async function saveTestRecord(payload: SaveTestPayload): Promise<{ data: TestRecord | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('test_records')
    .insert(payload)
    .select()
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as TestRecord, error: null };
}

export async function fetchTestRecords(): Promise<{ data: TestRecord[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('test_records')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as TestRecord[], error: null };
}

export async function fetchTestRecord(testId: string): Promise<{ data: TestRecord | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('test_records')
    .select('*')
    .eq('test_id', testId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as TestRecord | null, error: null };
}

export async function fetchHouseModels(): Promise<{ id: string; name: string; description: string | null; image_url: string | null; is_active: boolean }[]> {
  const { data } = await supabase
    .from('house_models')
    .select('id, name, description, image_url, is_active')
    .eq('is_active', true)
    .order('name');
  return data ?? [];
}
