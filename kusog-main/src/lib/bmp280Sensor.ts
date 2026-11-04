import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { notifySensorReadingsChanged } from '@/lib/testRecords';

export type BMP280Reading = {
  temperature_c: number;
  pressure_hpa: number;
  recorded_at: string;
};

type BMP280State = {
  reading: BMP280Reading | null;
  loading: boolean;
  error: string | null;
};

const POLL_INTERVAL_MS = 5000;
const SUMMARY_REFRESH_INTERVAL_MS = 15000;

function parseReading(value: unknown): BMP280Reading {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The BMP280 reading returned an invalid response.');
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.temperature_c !== 'number'
    || !Number.isFinite(row.temperature_c)
    || row.temperature_c < -40
    || row.temperature_c > 85
  ) {
    throw new Error('The BMP280 reading has an invalid temperature.');
  }
  if (
    typeof row.pressure_hpa !== 'number'
    || !Number.isFinite(row.pressure_hpa)
    || row.pressure_hpa < 300
    || row.pressure_hpa > 1100
  ) {
    throw new Error('The BMP280 reading has invalid pressure.');
  }
  if (typeof row.recorded_at !== 'string' || !Number.isFinite(Date.parse(row.recorded_at))) {
    throw new Error('The BMP280 reading has an invalid timestamp.');
  }
  return {
    temperature_c: row.temperature_c,
    pressure_hpa: row.pressure_hpa,
    recorded_at: row.recorded_at,
  };
}

export function useBMP280Sensor() {
  const lastSummaryRefresh = useRef(0);
  const lastSummaryReadingAt = useRef<string | null>(null);
  const [state, setState] = useState<BMP280State>({
    reading: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    let polling = false;
    setState({ reading: null, loading: true, error: null });

    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const { data, error } = await supabase
          .from('bmp280_readings')
          .select('temperature_c, pressure_hpa, recorded_at')
          .order('recorded_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!mounted) return;
        const reading = data ? parseReading(data) : null;
        setState({
          reading,
          loading: false,
          error: null,
        });
        if (
          reading
          && reading.recorded_at !== lastSummaryReadingAt.current
          && Date.now() - lastSummaryRefresh.current >= SUMMARY_REFRESH_INTERVAL_MS
        ) {
          lastSummaryRefresh.current = Date.now();
          lastSummaryReadingAt.current = reading.recorded_at;
          notifySensorReadingsChanged();
        }
      } catch (cause) {
        if (mounted) {
          setState((current) => ({
            ...current,
            loading: false,
            error: cause instanceof Error ? cause.message : 'Unable to load BMP280 readings.',
          }));
        }
      } finally {
        polling = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return state;
}
