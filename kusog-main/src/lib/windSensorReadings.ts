
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type WindSensorReading = {
  id: number | string;
  test_record_id: string;
  wind_speed_kmh: number;
  timestamp: string;
};

export type WindHistoryPoint = {
  recordedAt: number;
  speedKmh: number;
};

type WindSensorReadingsState = {
  recordId: string | null;
  reading: WindSensorReading | null;
  isPreviousTestReading: boolean;
  history: WindHistoryPoint[];
  loading: boolean;
};

const POLL_INTERVAL_MS = 5000;
const HISTORY_LENGTH = 120;

function parseReading(value: unknown, expectedRecordId?: string): WindSensorReading {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The wind sensor reading returned an invalid response.');
  }

  const row = value as Record<string, unknown>;
  const speed = Number(row.wind_speed_kmh);

  if (
    (typeof row.id !== 'number' && typeof row.id !== 'string')
    || typeof row.test_record_id !== 'string'
    || (expectedRecordId !== undefined && row.test_record_id !== expectedRecordId)
    || !Number.isFinite(speed)
    || speed < 0
    || typeof row.timestamp !== 'string'
    || !Number.isFinite(Date.parse(row.timestamp))
  ) {
    throw new Error('The wind sensor reading has invalid data.');
  }

  return {
    id: row.id,
    test_record_id: row.test_record_id,
    wind_speed_kmh: speed,
    timestamp: row.timestamp,
  };
}

export function useWindSensorReadings(recordId: string | null): WindSensorReadingsState {
  const [state, setState] = useState<WindSensorReadingsState>({
    recordId: null,
    reading: null,
    isPreviousTestReading: false,
    history: [],
    loading: false,
  });

  useEffect(() => {
    if (!recordId) {
      setState({
        recordId: null,
        reading: null,
        isPreviousTestReading: false,
        history: [],
        loading: false,
      });
      return;
    }

    let mounted = true;
    let polling = false;

    setState({
      recordId,
      reading: null,
      isPreviousTestReading: false,
      history: [],
      loading: true,
    });

    const poll = async () => {
      if (polling || !mounted) return;
      polling = true;

      try {
        const { data, error } = await supabase
          .from('ultrasonic_wind_readings')
          .select('id, wind_speed_kmh, timestamp, test_record_id')
          .eq('test_record_id', recordId)
          .order('timestamp', { ascending: false })
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!mounted) return;

        let selected = data;
        let isPreviousTestReading = false;

        if (!selected) {
          const { data: latestReading, error: fallbackError } = await supabase
            .from('ultrasonic_wind_readings')
            .select('id, wind_speed_kmh, timestamp, test_record_id')
            .order('timestamp', { ascending: false })
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (fallbackError) throw new Error(fallbackError.message);
          if (!mounted) return;

          selected = latestReading;
          isPreviousTestReading = Boolean(
            selected && selected.test_record_id !== recordId,
          );
        }

        if (!selected) {
          setState((current) =>
            current.recordId === recordId
              ? { ...current, loading: false }
              : current,
          );
          return;
        }

        const reading = parseReading(
          selected,
          isPreviousTestReading ? undefined : recordId,
        );

        setState((current) => {
          if (current.recordId !== recordId) return current;

          if (
            String(current.reading?.id) === String(reading.id)
            && current.isPreviousTestReading === isPreviousTestReading
          ) {
            return { ...current, loading: false };
          }

          return {
            recordId,
            reading,
            isPreviousTestReading,
            history: [
              ...current.history,
              {
                recordedAt: Date.parse(reading.timestamp),
                speedKmh: reading.wind_speed_kmh,
              },
            ].slice(-HISTORY_LENGTH),
            loading: false,
          };
        });
      } catch (cause) {
        if (mounted) {
          console.error(
            `Unable to load wind sensor readings for active test ${recordId}:`,
            cause,
          );
          setState((current) =>
            current.recordId === recordId
              ? { ...current, loading: false }
              : current,
          );
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
  }, [recordId]);

  return state.recordId === recordId
    ? state
    : {
        recordId,
        reading: null,
        isPreviousTestReading: false,
        history: [],
        loading: recordId !== null,
      };
}
