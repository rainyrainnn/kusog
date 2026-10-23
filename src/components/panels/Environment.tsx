import { useEffect, useState } from 'react';
import { Thermometer, Droplets, Gauge } from 'lucide-react';
import { Panel, StatusDot } from '../Panel';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useTestSession } from '@/hooks/useTestSession';

export function Environment() {
  const { ready, recordId } = useTestSession();
  const [reading, setReading] = useState<{
    temperature: number;
    humidity: number;
    recordedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !recordId) {
      setReading(null);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    let polling = false;
    setReading(null);
    setLoading(true);
    setError(null);

    const fetchLatest = async () => {
      if (polling) return;
      polling = true;

      try {
        if (!isSupabaseConfigured) {
          throw new Error('Supabase is not configured. Check the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY settings.');
        }

        const { data, error: queryError } = await supabase
          .from('dht11_readings')
          .select('temperature_c, humidity_percent, recorded_at')
          .eq('test_record_id', recordId)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (queryError) throw new Error(queryError.message);
        if (!active) return;

        if (!data) {
          setReading(null);
          setError(null);
        } else {
          const temperature = Number(data.temperature_c);
          const humidity = Number(data.humidity_percent);
          if (
            data.temperature_c === null
            || data.humidity_percent === null
            || !Number.isFinite(temperature)
            || !Number.isFinite(humidity)
          ) {
            throw new Error('The latest DHT11 row contains an invalid temperature or humidity value.');
          }
          if (typeof data.recorded_at !== 'string' || Number.isNaN(Date.parse(data.recorded_at))) {
            throw new Error('The latest DHT11 row has an invalid recorded_at timestamp.');
          }

          setReading({
            temperature,
            humidity,
            recordedAt: data.recorded_at,
          });
          setError(null);
        }
      } catch (cause) {
        if (active) {
          setReading(null);
          setError(cause instanceof Error ? cause.message : 'Unable to load DHT11 readings from Supabase.');
        }
      } finally {
        polling = false;
        if (active) setLoading(false);
      }
    };

    void fetchLatest();
    const interval = window.setInterval(() => void fetchLatest(), 10_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [ready, recordId]);

  const readingOnline = Boolean(
    reading
    && Date.now() - Date.parse(reading.recordedAt) <= 30_000
    && Date.now() - Date.parse(reading.recordedAt) >= -30_000,
  );
  const status = loading
    ? 'LOADING'
    : error
      ? 'DATABASE ERROR'
      : reading
        ? readingOnline ? 'ONLINE' : 'OFFLINE'
        : ready ? 'NO DATA' : 'WAITING TO START';

  return (
    <Panel
      title="DHT11 Environment"
      icon={<Gauge className="h-4 w-4" />}
      right={
        <span className="flex items-center gap-1.5">
          <StatusDot color={error ? 'danger' : readingOnline ? 'ok' : 'warn'} pulse={Boolean(readingOnline && !error)} />
          <span className={`text-[9px] font-bold tracking-wider ${error ? 'text-danger-400' : readingOnline ? 'text-ok-400' : 'text-warn-400'}`}>
            {status}
          </span>
        </span>
      }
      className="h-full"
    >
      <div className="grid h-full grid-cols-1 content-center gap-3 sm:grid-cols-2">
        <ReadingCard
          icon={Thermometer}
          label="Temperature"
          value={reading ? `${reading.temperature.toFixed(1)} °C` : '— °C'}
          color="text-warn-400"
        />
        <ReadingCard
          icon={Droplets}
          label="Relative Humidity"
          value={reading ? `${reading.humidity.toFixed(1)} %` : '— %'}
          color="text-accent-400"
        />
        <div className="sm:col-span-2">
          {loading ? (
            <p className="text-center text-xs text-slate-400">Loading the latest DHT11 reading…</p>
          ) : error ? (
            <div className="rounded-lg border border-danger-400/20 bg-danger-400/5 px-3 py-2 text-center">
              <p className="text-xs font-semibold text-danger-300">Unable to load DHT11 data</p>
              <p className="mt-1 break-words text-[10px] text-slate-400">{error}</p>
            </div>
          ) : reading ? (
            <div className="text-center">
              <p className="text-[10px] text-slate-400">
                Last recorded: <time dateTime={reading.recordedAt}>{new Date(reading.recordedAt).toLocaleString()}</time>
              </p>
              {!readingOnline && (
                <p className="mt-1 text-xs text-warn-300">No recent DHT11 reading. Showing the last recorded values.</p>
              )}
            </div>
          ) : (
            <p className="text-center text-xs text-warn-300">
              {ready ? 'No DHT11 readings for this test yet. The sensor may be offline.' : 'Start a test to enable DHT11 readings.'}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

function ReadingCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Thermometer;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-md bg-base-700/60 ${color}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="mt-3 font-mono text-2xl font-bold text-slate-100">{value}</p>
    </div>
  );
}
