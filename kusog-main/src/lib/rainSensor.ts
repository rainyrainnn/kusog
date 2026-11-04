
import { useEffect, useState } from 'react';
import { parseRainApiResponse } from '@/lib/rainSensorParsing';

export type RainSensorSource = 'inactive' | 'hardware';

export type RainSensorData = {
  source: RainSensorSource;
  connected: boolean;
  offline: boolean;
  rainLevel: string;
  rawRainLevel: string;
  rainState: string;
  rain24h: number | null;
  batteryPercentage: number | null;
  recordedAt: string | null;
};

const POLL_INTERVAL_MS = configuredInterval(import.meta.env.VITE_KUSOG_RAIN_POLL_INTERVAL_MS, 10_000);
const REQUEST_TIMEOUT_MS = 4000;

const EMPTY_SENSOR: RainSensorData = {
  source: 'inactive',
  connected: false,
  offline: false,
  rainLevel: '',
  rawRainLevel: '',
  rainState: 'unknown',
  rain24h: null,
  batteryPercentage: null,
  recordedAt: null,
};

function configuredInterval(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1000 ? parsed : fallback;
}

export function useRainSensor(enabled: boolean) {
  const [data, setData] = useState<RainSensorData>(EMPTY_SENSOR);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setData(EMPTY_SENSOR);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    let pollTimer: number | undefined;
    let controller: AbortController | null = null;
    setData({ ...EMPTY_SENSOR, offline: false });
    setError(null);
    setLoading(true);

    const poll = async () => {
      const requestController = new AbortController();
      controller = requestController;
      const timeout = window.setTimeout(() => requestController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch('/kusog-rain/api/rain', {
          signal: requestController.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Rain API returned HTTP ${response.status}`);
        }

        const result = parseRainApiResponse(await response.json());
        if (!active) return;

        if (result.connected) {
          setData({
            source: 'hardware',
            connected: true,
            offline: false,
            rainLevel: result.rainLevel,
            rawRainLevel: result.rainLevel,
            rainState: result.rainState,
            rain24h: result.rain24h,
            batteryPercentage: result.batteryPercentage,
            recordedAt: null,
          });
          setError(null);
        } else {
          setData({ ...EMPTY_SENSOR, source: 'hardware', offline: true });
          setError(result.error);
        }
      } catch (cause) {
        if (!active) return;
        setData({ ...EMPTY_SENSOR, source: 'hardware', offline: true });
        setError(cause instanceof Error ? cause.message : 'Unable to connect to the rain sensor.');
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
        if (active) pollTimer = window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    };

    void poll();
    return () => {
      active = false;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
      controller?.abort();
    };
  }, [enabled]);

  return {
    data: enabled ? data : EMPTY_SENSOR,
    error: enabled ? error : null,
    loading: enabled && loading,
  };
}
