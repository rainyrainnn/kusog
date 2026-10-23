import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTestSession } from '@/hooks/useTestSession';

export type WindPoint = { t: number; value: number };

export type WindSensorData = {
  connected: boolean;
  windSpeedMps: number | null;
  windDirectionDeg: number | null;
  recordedAt: string | null;
  history: WindPoint[];
};

const OFFLINE_AFTER_MS = 5_000;
const POLL_INTERVAL_MS = 1_000;
const HISTORY_LENGTH = 120;

const EMPTY_SENSOR: WindSensorData = {
  connected: false,
  windSpeedMps: null,
  windDirectionDeg: null,
  recordedAt: null,
  history: [],
};

function isRecent(timestamp: string | null): boolean {
  if (!timestamp) return false;
  const recorded = Date.parse(timestamp);
  return Number.isFinite(recorded) && Date.now() - recorded <= OFFLINE_AFTER_MS && recorded <= Date.now() + 30_000;
}

function numericOrNull(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function useWindSensor(): WindSensorData {
  const { ready, recordId } = useTestSession();
  const [data, setData] = useState<WindSensorData>(EMPTY_SENSOR);
  const latestId = useRef<number | string | null>(null);
  const sampleNumber = useRef(0);

  useEffect(() => {
    if (!ready || !recordId) {
      latestId.current = null;
      sampleNumber.current = 0;
      setData(EMPTY_SENSOR);
      return;
    }

    let active = true;
    let polling = false;
    setData(EMPTY_SENSOR);

    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const { data: row, error } = await supabase
          .from('wind_sensor_readings')
          .select('id, wind_speed, wind_direction, recorded_at')
          .eq('test_record_id', recordId)
          .order('recorded_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!active) return;
        if (!row) {
          latestId.current = null;
          sampleNumber.current = 0;
          setData(EMPTY_SENSOR);
          return;
        }

        const speed = numericOrNull(row.wind_speed);
        const direction = numericOrNull(row.wind_direction);
        const recordedAt = typeof row.recorded_at === 'string' ? row.recorded_at : null;
        const validReading = speed !== null && speed >= 0 && direction !== null && direction >= 0 && direction < 360;

        if (validReading && latestId.current !== row.id) {
          latestId.current = row.id;
          sampleNumber.current += 1;
          setData((current) => ({
            connected: isRecent(recordedAt),
            windSpeedMps: speed,
            windDirectionDeg: direction,
            recordedAt,
            history: [...current.history.slice(-(HISTORY_LENGTH - 1)), { t: sampleNumber.current, value: speed }],
          }));
        } else {
          setData((current) => ({
            ...current,
            connected: validReading && isRecent(recordedAt),
            windSpeedMps: validReading ? speed : null,
            windDirectionDeg: validReading ? direction : null,
            recordedAt,
          }));
        }
      } catch {
        if (active) setData((current) => ({ ...current, connected: false }));
      } finally {
        polling = false;
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      setData((current) => ({ ...current, connected: isRecent(current.recordedAt) }));
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [ready, recordId]);

  return data;
}