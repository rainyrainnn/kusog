import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type RainSensorData = {
  connected: boolean;
  offline: boolean;
  rainLevel: string;
  rawRainLevel: string;
  rainState: string;
  rain24h: number | null;
  batteryPercentage: number | null;
  recordedAt: string | null;
};

const OFFLINE_AFTER_MS = 90_000;
const POLL_INTERVAL_MS = 10_000;

const EMPTY_SENSOR: RainSensorData = {
  connected: false,
  offline: false,
  rainLevel: '',
  rawRainLevel: '',
  rainState: 'unknown',
  rain24h: null,
  batteryPercentage: null,
  recordedAt: null,
};

function numericOrNull(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecent(timestamp: string | null): boolean {
  if (!timestamp) return false;
  const recorded = Date.parse(timestamp);
  return Number.isFinite(recorded) && Date.now() - recorded <= OFFLINE_AFTER_MS && recorded <= Date.now() + 30_000;
}

export function useRainSensor() {
  const [data, setData] = useState<RainSensorData>(EMPTY_SENSOR);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const noReadingSince = useRef(Date.now());
  const hadReading = useRef(false);

  useEffect(() => {
    let active = true;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const { data: row, error: queryError } = await supabase
          .from('rain_sensor_readings')
          .select('rain_level, rain_state, rain_24h, battery_percentage, recorded_at')
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (queryError) throw new Error(queryError.message);
        if (active) {
          if (!row) {
            const now = Date.now();
            if (hadReading.current) noReadingSince.current = now;
            hadReading.current = false;
            setData({
              ...EMPTY_SENSOR,
              offline: now - noReadingSince.current >= OFFLINE_AFTER_MS,
            });
            setError(null);
          } else {
            const rawLevel = row.rain_level === null ? '' : String(row.rain_level);
            const recordedAt = row.recorded_at;
            hadReading.current = true;
            const connected = isRecent(recordedAt);
            setData({
              connected,
              offline: !connected,
              rainLevel: rawLevel,
              rawRainLevel: rawLevel,
              rainState: row.rain_state ?? 'unknown',
              rain24h: numericOrNull(row.rain_24h),
              batteryPercentage: numericOrNull(row.battery_percentage),
              recordedAt,
            });
            setError(null);
          }
        }
      } catch (cause) {
        if (active) {
          setData((current) => {
            const connected = isRecent(current.recordedAt);
            const offline = current.recordedAt
              ? !connected
              : Date.now() - noReadingSince.current >= OFFLINE_AFTER_MS;
            return { ...current, connected, offline };
          });
          setError(cause instanceof Error ? cause.message : 'Unable to read rain sensor.');
        }
      } finally {
        if (active) setLoading(false);
        polling = false;
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      setData((current) => {
        const connected = isRecent(current.recordedAt);
        const offline = current.recordedAt
          ? !connected
          : Date.now() - noReadingSince.current >= OFFLINE_AFTER_MS;
        return { ...current, connected, offline };
      });
      void poll();
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return { data, error, loading };
}