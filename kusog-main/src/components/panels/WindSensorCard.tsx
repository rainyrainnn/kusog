import { useEffect, useState } from 'react';
import { Wind } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipValueType,
} from 'recharts';
import { useWindSensorReadings } from '@/lib/windSensorReadings';
import { Panel, StatusDot } from '@/components/Panel';

type WindSensorCardProps = {
  recordId: string | null;
};

type SensorStatus = 'LIVE' | 'OFFLINE';

const STATUS_STYLES: Record<SensorStatus, { text: string; dot: 'ok' | 'warn' | 'danger' }> = {
  LIVE: { text: 'text-ok-300', dot: 'ok' },
  OFFLINE: { text: 'text-danger-300', dot: 'danger' },
};

const STALE_AFTER_MS = 30_000;

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function WindSensorCard({ recordId }: WindSensorCardProps) {
  const { reading, history, loading, isPreviousTestReading } = useWindSensorReadings(recordId);
  const hasTest = recordId !== null;
  const [now, setNow] = useState(() => Date.now());
  const readingTimestamp = reading?.recorded_at ?? null;

  useEffect(() => {
    if (!recordId || !readingTimestamp) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [recordId, readingTimestamp]);

  const recordedAtMs = reading ? Date.parse(reading.recorded_at) : Number.NaN;
  const ageMs = now - recordedAtMs;
  const fresh = Number.isFinite(recordedAtMs) && ageMs >= -STALE_AFTER_MS && ageMs < STALE_AFTER_MS;
  const status: SensorStatus = hasTest && reading && fresh ? 'LIVE' : 'OFFLINE';
  const style = STATUS_STYLES[status];
  const timestamp = formatTime(reading?.recorded_at ?? null);

  return (
    <Panel
      title="Cup Anemometer"
      icon={<Wind className="h-4 w-4" />}
      right={
        <span role="status" className={`inline-flex shrink-0 items-center gap-1.5 text-[9px] font-bold tracking-wider ${style.text}`}>
          <StatusDot color={style.dot} pulse={false} />
          {status}
        </span>
      }
      bodyClassName="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">Wind speed</p>
          <p className="mt-1 font-mono text-3xl font-semibold tracking-tight text-slate-100">
            {reading ? (reading.wind_speed * 3.6).toFixed(1) : '--'}
            <span className="ml-2 text-sm font-medium text-slate-400">km/h</span>
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">Wind direction</p>
          <p className="mt-1 font-mono text-3xl font-semibold tracking-tight text-slate-100">
            {reading?.wind_direction === null || reading?.wind_direction === undefined
              ? 'N/A'
              : `${reading.wind_direction.toFixed(1)}Â°`}
          </p>
        </div>
      </div>

      <div className="border-t border-sky-200/10 pt-2.5">
        <p className="text-[10px] text-slate-500">Last update{timestamp ? ` Â· ${timestamp}` : ' Â· --'}</p>
        {!hasTest && <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Start a test to view its wind sensor readings.</p>}
        {hasTest && isPreviousTestReading && reading && (
          <p className="mt-1 text-[10px] leading-relaxed text-warn-300">
            Showing the latest saved reading from a previous test ({reading.test_record_id}); this test has no wind readings yet.
          </p>
        )}
        {hasTest && !reading && !loading && (
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            Waiting for a wind reading from the Raspberry Pi uploader. Check that the wind uploader is running and logging successful uploads for this active test.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">Wind speed history Â· km/h</h3>
        {history.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-base-600/70 bg-base-950/30 px-5 text-center">
            <p className="max-w-sm text-xs leading-relaxed text-slate-500">
              {hasTest ? 'Recorded wind speed samples for this test will appear here.' : 'History is available during a test.'}
            </p>
          </div>
        ) : (
          <div className="h-40 min-w-0" aria-label="Wind speed history from Supabase readings in km/h">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                <defs>
                  <linearGradient id="wind-sensor-history-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#26364D" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="recordedAt"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 9, fill: '#94A3B8' }}
                  stroke="#26364D"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#94A3B8' }}
                  stroke="#26364D"
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(value: number) => value.toFixed(1)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B1220', border: '1px solid #26364D', borderRadius: '8px', fontSize: '11px', color: '#F5F8FC' }}
                  labelFormatter={(value) => formatTime(new Date(Number(value)).toISOString()) ?? '--'}
                  formatter={(value: TooltipValueType | undefined) => [
                    typeof value === 'number' ? `${value.toFixed(1)} km/h` : '--',
                    'Wind speed',
                  ]}
                />
                <Area type="monotone" dataKey="speedKmh" stroke="#38BDF8" strokeWidth={2} fill="url(#wind-sensor-history-fill)" isAnimationActive={false} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-[9px] text-slate-500">Latest 120 readings saved for the active test Â· refreshed every 5 seconds</p>
      </div>
    </Panel>
  );
}
