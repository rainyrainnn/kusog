import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type RainSensorReading = {
  rain_level: string;
  rain_state: string;
  rain_24h: number | null;
  battery_percentage: number | null;
  recorded_at: string;
};

type RainSensorReadingsState = {
  reading: RainSensorReading | null;
  loading: boolean;
  error: string | null;
};

const POLL_INTERVAL_MS = 5000;

function optionalNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error(`The rain sensor reading has an invalid ${field}.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`The rain sensor reading has an invalid ${field}.`);
  return parsed;
}

function parseReading(value: unknown): RainSensorReading {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The rain sensor reading returned an invalid response.');
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.rain_level !== 'string'
    || typeof row.rain_state !== 'string'
    || typeof row.recorded_at !== 'string'
    || !Number.isFinite(Date.parse(row.recorded_at))
  ) {
    throw new Error('The rain sensor reading is missing a valid level, state, or timestamp.');
  }

  const rain24h = optionalNumber(row.rain_24h, 'rainfall');
  const batteryPercentage = optionalNumber(row.battery_percentage, 'battery percentage');
  if (batteryPercentage !== null && (batteryPercentage < 0 || batteryPercentage > 100)) {
    throw new Error('The rain sensor reading has an invalid battery percentage.');
  }

  return {
    rain_level: row.rain_level,
    rain_state: row.rain_state,
    rain_24h: rain24h,
    battery_percentage: batteryPercentage,
    recorded_at: row.recorded_at,
  };
}

export function useRainSensorReadings(recordId: string | null): RainSensorReadingsState {
  const [state, setState] = useState<RainSensorReadingsState>({
    reading: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!recordId) {
      setState({ reading: null, loading: false, error: null });
      return;
    }

    let active = true;
    let polling = false;
    setState({ reading: null, loading: true, error: null });

    const poll = async () => {
      if (polling) return;
      polling = true;

      try {
        const { data, error } = await supabase
          .from('rain_sensor_readings')
          .select('rain_level, rain_state, rain_24h, battery_percentage, recorded_at, test_record_id')
          .eq('test_record_id', recordId)
          .order('recorded_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!active) return;
        setState({
          reading: data ? parseReading(data) : null,
          loading: false,
          error: null,
        });
      } catch (cause) {
        if (active) {
          setState((current) => ({
            ...current,
            loading: false,
            error: cause instanceof Error ? cause.message : 'Unable to load rain sensor readings from Supabase.',
          }));
        }
      } finally {
        polling = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [recordId]);

  return state;
}
