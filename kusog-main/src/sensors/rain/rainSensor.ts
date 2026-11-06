
import { useEffect, useState } from 'react';
import { parseRainApiResponse } from '@/sensors/rain/rainSensorParsing';

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

const POLL_INTERVAL_MS = 5000;
const REQUEST_TIMEOUT_MS = 4000;
const CONFIGURED_RAIN_URL = (import.meta.env.VITE_KUSOG_RAIN_URL as string | undefined)?.trim() ?? '';
const RAIN_API_URL = import.meta.env.DEV ? '/kusog-rain' : CONFIGURED_RAIN_URL;

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
    let polling = false;
    let controller: AbortController | null = null;
    setData({ ...EMPTY_SENSOR, offline: false });
    setError(null);
    setLoading(true);

    const poll = async () => {
      if (polling) return;
      polling = true;
      const requestController = new AbortController();
      controller = requestController;
      const timeout = window.setTimeout(() => requestController.abort(), REQUEST_TIMEOUT_MS);

      try {
        if (!RAIN_API_URL) {
          throw new Error('Set VITE_KUSOG_RAIN_URL to the Raspberry Pi rain API endpoint.');
        }

        const response = await fetch(RAIN_API_URL, {
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
        polling = false;
      }
    };

    void poll();
    const pollTimer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(pollTimer);
      controller?.abort();
    };
  }, [enabled]);

  return {
    data: enabled ? data : EMPTY_SENSOR,
    error: enabled ? error : null,
    loading: enabled && loading,
  };
}
