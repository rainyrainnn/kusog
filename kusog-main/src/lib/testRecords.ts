/*
 * Test record service — all Supabase reads/writes for test_records go here.
 * When real hardware is connected, sensor readings flow in through this same
 * interface; only the data source changes, not the save/fetch shape.
 */

import { supabase } from './supabase';
import type { LogEntry } from '@/hooks/useSimulation';
import type { ActualWeatherStatus, StructuralDamageStatus, TestMode } from './testClassification';

export type TestRecord = {
  id: string;
  operator_id: string | null;
  test_id: string;
  scenario: string;
  test_mode: TestMode | null;
  actual_weather_status: ActualWeatherStatus | null;
  structural_damage_status: StructuralDamageStatus | null;
  start_time: string | null;
  end_time: string | null;
  duration_seconds: number | null;
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
  wind_speed: number | null;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  current_force: number | null;
  ai_confidence: number | null;
  ai_roof: string | null;
  ai_movement: string | null;
  ai_cracks: string | null;
  ai_overall: string | null;
  // controls snapshot
  fan_speed: number;
  rain_level: string | null;
  rain_level_raw: string | null;
  rain_state: string | null;
  rain_24h: number | null;
  rain_battery: number | null;
  rain_sensor_connected: boolean | null;
  rain_sensor_reading_recorded_at?: string | null;
  wind_direction: number | null;
  // camera
  camera_status: string;
  camera_stream_url: string | null;
  // misc
  log_entries: LogEntry[] | null;
  created_at: string;
};

export type TestRecordWithSensorSummary = TestRecord & {
  wind_speed_kmh: number | null;
  wind_direction_degrees: number | null;
  wind_reading_recorded_at: string | null;
  uplift_force_n: number | null;
  load_cell_reading_recorded_at: string | null;
  bmp280_temperature_c: number | null;
  bmp280_pressure_hpa: number | null;
  bmp280_reading_recorded_at: string | null;
  rain_reading_level: string | null;
  rain_reading_state: string | null;
  rain_reading_24h: number | null;
  rain_reading_battery_percentage: number | null;
  rain_reading_recorded_at: string | null;
};

export type SaveTestPayload = Omit<TestRecord, 'id' | 'created_at'>;

export type StartTestPayload = { id: string }
  & Pick<SaveTestPayload, 'test_id' | 'scenario' | 'test_mode' | 'actual_weather_status' | 'structural_damage_status' | 'start_time' | 'end_time' | 'duration_seconds' | 'status'>
  & Partial<Omit<SaveTestPayload, 'operator_id' | 'test_id' | 'scenario' | 'test_mode' | 'actual_weather_status' | 'structural_damage_status' | 'start_time' | 'end_time' | 'duration_seconds' | 'status'>>;

export type FinalTestPayload = Pick<SaveTestPayload, 'end_time' | 'duration_seconds' | 'status'>
  & Partial<Omit<SaveTestPayload, 'operator_id' | 'test_id' | 'scenario' | 'start_time' | 'end_time' | 'duration_seconds' | 'status'>>;

const recordsChangedEvent = 'kusog:test-records-changed';
const sensorReadingsChangedEvent = 'kusog:sensor-readings-changed';

export function notifyTestRecordsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(recordsChangedEvent));
}

export function subscribeToTestRecordsChanged(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(recordsChangedEvent, listener);
  return () => window.removeEventListener(recordsChangedEvent, listener);
}

export function notifySensorReadingsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(sensorReadingsChangedEvent));
}

export function subscribeToSensorReadingsChanged(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(sensorReadingsChangedEvent, listener);
  return () => window.removeEventListener(sensorReadingsChangedEvent, listener);
}

export async function getRunningTestRecord(): Promise<TestRecord | null> {
  const { data, error } = await supabase
    .from('test_records')
    .select('*')
    .eq('status', 'RUNNING')
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as TestRecord | null;
}

export async function startTestRecord(payload: StartTestPayload): Promise<TestRecord> {
  if (payload.scenario === 'Custom Scenario') {
    throw new Error('Choose a supported scenario before starting a simulation.');
  }
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user.user) throw new Error(userError?.message || 'Sign in before starting a simulation.');
  const recordId = payload.id;
  const existing = await fetchTestRecordById(recordId, user.user.id);
  if (existing) {
    if (existing.status === 'RUNNING') return existing;
    throw new Error(`Test ${existing.test_id} has already been finalized.`);
  }

  const active = await getRunningTestRecord();
  if (active) throw new Error(`Test ${active.test_id} is still marked RUNNING. Resume or finalize it before starting another simulation.`);

  const { data, error } = await supabase
    .from('test_records')
    .insert({ ...payload, id: recordId, operator_id: user.user.id })
    .select()
    .single();
  if (error) {
    const retry = await fetchTestRecordById(recordId, user.user.id);
    if (retry?.status === 'RUNNING') {
      notifyTestRecordsChanged();
      return retry;
    }
    if (retry) throw new Error(`Test ${retry.test_id} has already been finalized.`);
    if (error.code === '23505') throw new Error('Another simulation is already running.');
    throw new Error(error.message);
  }
  notifyTestRecordsChanged();
  return data as TestRecord;
}

async function fetchTestRecordById(id: string, operatorId: string): Promise<TestRecord | null> {
  const { data, error } = await supabase
    .from('test_records')
    .select('*')
    .eq('id', id)
    .eq('operator_id', operatorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as TestRecord | null;
}

export async function finalizeTestRecord(recordId: string, payload: FinalTestPayload): Promise<TestRecord> {
  const { data, error } = await supabase
    .from('test_records')
    .update(payload)
    .eq('id', recordId)
    .eq('status', 'RUNNING')
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    notifyTestRecordsChanged();
    return data as TestRecord;
  }

  const existing = await fetchTestRecord(recordId);
  if (existing.error) throw existing.error;
  if (existing.data && ['COMPLETED', 'FAILED'].includes(existing.data.status)) return existing.data;
  throw new Error(`Test record ${recordId} was not finalized. It remains available for a safe retry.`);
}

export async function updateRunningTestAssessment(
  recordId: string,
  payload: Pick<FinalTestPayload, 'ai_confidence' | 'ai_cracks' | 'ai_overall' | 'structural_damage_status'>,
): Promise<void> {
  const { data, error } = await supabase
    .from('test_records')
    .update(payload)
    .eq('id', recordId)
    .eq('status', 'RUNNING')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Unable to save the YOLO assessment for running test record ${recordId}.`);
  notifyTestRecordsChanged();
}

export async function fetchTestRecords(): Promise<{ data: TestRecord[]; error: Error | null }> {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError) return { data: [], error: new Error(userError.message) };
  if (!user.user) return { data: [], error: new Error('Sign in to view simulation records.') };
  const { data, error } = await supabase
    .from('test_records')
    .select('*')
    .eq('operator_id', user.user.id)
    .order('start_time', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as TestRecord[], error: null };
}

export async function fetchTestRecordsWithSensorReadings(): Promise<{
  data: TestRecordWithSensorSummary[];
  error: Error | null;
}> {
  const { data: records, error } = await fetchTestRecords();
  if (error) return { data: [], error };

  try {
    const recordsWithReadings: TestRecordWithSensorSummary[] = [];
    const batchSize = 10;

    for (let index = 0; index < records.length; index += batchSize) {
      const batch = records.slice(index, index + batchSize);
      const summaries = await Promise.all(batch.map(async (record) => {
        let windQuery = supabase
          .from('wind_sensor_readings')
          .select('wind_speed, wind_direction, recorded_at')
          .eq('test_record_id', record.id)
          .order('recorded_at', { ascending: false })
          .limit(1);
        let loadCellQuery = supabase
          .from('load_cell_readings')
          .select('uplift_force_n, recorded_at')
          .eq('test_record_id', record.id)
          .order('recorded_at', { ascending: false })
          .limit(1);
        let bmp280Query = supabase
          .from('bmp280_readings')
          .select('temperature_c, pressure_hpa, recorded_at')
          .eq('test_record_id', record.id)
          .order('recorded_at', { ascending: false })
          .limit(1);
        let rainQuery = supabase
          .from('rain_sensor_readings')
          .select('rain_level, rain_state, rain_24h, battery_percentage, recorded_at')
          .eq('test_record_id', record.id)
          .order('recorded_at', { ascending: false })
          .limit(1);

        if (record.start_time) {
          windQuery = windQuery.gte('recorded_at', record.start_time);
          loadCellQuery = loadCellQuery.gte('recorded_at', record.start_time);
          bmp280Query = bmp280Query.gte('recorded_at', record.start_time);
          rainQuery = rainQuery.gte('recorded_at', record.start_time);
        }
        if (record.end_time) {
          windQuery = windQuery.lte('recorded_at', record.end_time);
          loadCellQuery = loadCellQuery.lte('recorded_at', record.end_time);
          bmp280Query = bmp280Query.lte('recorded_at', record.end_time);
          rainQuery = rainQuery.lte('recorded_at', record.end_time);
        }

        const [windResult, loadCellResult, bmp280Result, rainResult] = await Promise.all([
          windQuery,
          loadCellQuery,
          bmp280Query,
          rainQuery,
        ]);
        if (windResult.error) throw new Error(windResult.error.message);
        if (loadCellResult.error) throw new Error(loadCellResult.error.message);
        if (bmp280Result.error) throw new Error(bmp280Result.error.message);
        if (rainResult.error) throw new Error(rainResult.error.message);

        const wind = windResult.data?.[0];
        const loadCell = loadCellResult.data?.[0];
        const bmp280 = bmp280Result.data?.[0];
        const rain = rainResult.data?.[0];
        const windSpeedMps = wind?.wind_speed === null || wind?.wind_speed === undefined
          ? null
          : Number(wind.wind_speed);
        const windDirection = wind?.wind_direction === null || wind?.wind_direction === undefined
          ? null
          : Number(wind.wind_direction);
        const upliftForce = loadCell?.uplift_force_n === null || loadCell?.uplift_force_n === undefined
          ? null
          : Number(loadCell.uplift_force_n);

        return {
          ...record,
          wind_speed_kmh: windSpeedMps !== null && Number.isFinite(windSpeedMps) ? windSpeedMps * 3.6 : null,
          wind_direction_degrees: windDirection !== null && Number.isFinite(windDirection) ? windDirection : null,
          wind_reading_recorded_at: wind?.recorded_at ?? null,
          uplift_force_n: upliftForce !== null && Number.isFinite(upliftForce) ? upliftForce : null,
          load_cell_reading_recorded_at: loadCell?.recorded_at ?? null,
          bmp280_temperature_c: bmp280?.temperature_c === null || bmp280?.temperature_c === undefined
            ? null
            : Number(bmp280.temperature_c),
          bmp280_pressure_hpa: bmp280?.pressure_hpa === null || bmp280?.pressure_hpa === undefined
            ? null
            : Number(bmp280.pressure_hpa),
          bmp280_reading_recorded_at: bmp280?.recorded_at ?? null,
          rain_reading_level: rain?.rain_level ?? null,
          rain_reading_state: rain?.rain_state ?? null,
          rain_reading_24h: rain?.rain_24h === null || rain?.rain_24h === undefined
            ? null
            : Number(rain.rain_24h),
          rain_reading_battery_percentage: rain?.battery_percentage === null || rain?.battery_percentage === undefined
            ? null
            : Number(rain.battery_percentage),
          rain_reading_recorded_at: rain?.recorded_at ?? null,
        };
      }));

      recordsWithReadings.push(...summaries);
    }

    return { data: recordsWithReadings, error: null };
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error : new Error('Unable to load sensor readings for test records.'),
    };
  }
}

export async function fetchLatestRainSensorReading(testRecordId: string): Promise<{
  data: {
    rain_level: string;
    rain_state: string;
    rain_24h: number | null;
    battery_percentage: number | null;
    recorded_at: string;
  } | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('rain_sensor_readings')
    .select('rain_level, rain_state, rain_24h, battery_percentage, recorded_at')
    .eq('test_record_id', testRecordId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  return {
    data: data ? {
      rain_level: data.rain_level,
      rain_state: data.rain_state,
      rain_24h: data.rain_24h === null ? null : Number(data.rain_24h),
      battery_percentage: data.battery_percentage,
      recorded_at: data.recorded_at,
    } : null,
    error: null,
  };
}

export async function fetchTestRecord(recordId: string): Promise<{ data: TestRecord | null; error: Error | null }> {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError) return { data: null, error: new Error(userError.message) };
  if (!user.user) return { data: null, error: new Error('Sign in to access simulation records.') };
  const { data, error } = await supabase
    .from('test_records')
    .select('*')
    .eq('id', recordId)
    .eq('operator_id', user.user.id)
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
