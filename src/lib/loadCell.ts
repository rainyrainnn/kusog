import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTestSession } from '@/hooks/useTestSession';

export type LoadCellData = {
  connected: boolean;
  rawValue: number | null;
  weightGrams: number | null;
  weightKg: number | null;
  upliftForceN: number | null;
  recordedAt: string | null;
};

const OFFLINE_AFTER_MS = 5_000;
const POLL_INTERVAL_MS = 1_000;

const EMPTY_READING: LoadCellData = {
  connected: false,
  rawValue: null,
  weightGrams: null,
  weightKg: null,
  upliftForceN: null,
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

export function useLoadCell() {
  const { ready, recordId } = useTestSession();
  const [data, setData] = useState<LoadCellData>(EMPTY_READING);

  useEffect(() => {
    if (!ready || !recordId) {
      setData(EMPTY_READING);
      return;
    }

    let active = true;
    let polling = false;
    setData(EMPTY_READING);

    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const { data: row, error } = await supabase
          .from('load_cell_readings')
          .select('id, raw_value, weight_grams, weight_kg, uplift_force_n, recorded_at')
          .eq('test_record_id', recordId)
          .order('recorded_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!active) return;
        if (!row) {
          setData(EMPTY_READING);
          return;
        }

        const weightGrams = numericOrNull(row.weight_grams);
        const weightKg = numericOrNull(row.weight_kg) ?? (weightGrams === null ? null : weightGrams / 1000);
        const upliftForceN = numericOrNull(row.uplift_force_n)
          ?? (weightKg === null ? null : weightKg * 9.80665);
        const recordedAt = typeof row.recorded_at === 'string' ? row.recorded_at : null;

        setData({
          connected: isRecent(recordedAt),
          rawValue: numericOrNull(row.raw_value),
          weightGrams: weightGrams ?? (weightKg === null ? null : weightKg * 1000),
          weightKg,
          upliftForceN,
          recordedAt,
        });
      } catch {
        if (active) setData(EMPTY_READING);
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