import { useEffect, useMemo, useState } from 'react';
import { Activity, CloudRain, Compass, Gauge, LineChart as LineChartIcon, RefreshCw, Thermometer, Weight, Wind } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import type { Simulation, TelemetryPoint } from '@/hooks/useSimulation';
import { useBMP280Sensor } from '@/lib/bmp280Sensor';
import type { WindSensorData } from '@/lib/windSensor';
import type { LoadCellData } from '@/lib/loadCell';
import type { RainSensorData } from '@/lib/rainSensor';
import {
  fetchTestRecordsWithSensorReadings,
  subscribeToSensorReadingsChanged,
  subscribeToTestRecordsChanged,
  type TestRecordWithSensorSummary,
} from '@/lib/testRecords';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  LineChart as RechartsLineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipValueType,
} from 'recharts';

type HistoricalPoint = {
  label: string;
  value: number;
  testId: string;
  scenario: string;
  readingAt: string | null;
};

const tooltipStyle = {
  backgroundColor: '#0B1220',
  border: '1px solid #26364D',
  borderRadius: '8px',
  fontSize: '11px',
  color: '#F5F8FC',
};

const HISTORY_RANGES = [
  { label: '10 tests', value: 10 },
  { label: '25 tests', value: 25 },
  { label: 'All', value: Number.POSITIVE_INFINITY },
];

export function GraphsView({ sim, wind, loadCell, rain }: {
  sim: Simulation;
  wind: WindSensorData;
  loadCell: LoadCellData;
  rain: RainSensorData;
}) {
  const [records, setRecords] = useState<TestRecordWithSensorSummary[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [historyRange, setHistoryRange] = useState(Number.POSITIVE_INFINITY);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const testActive = sim.isTestRunning && !sim.isFinalizing;
  const bmp280 = useBMP280Sensor(testActive);

  useEffect(() => {
    let active = true;
    let loading = false;
    let refreshPending = false;

    const load = async () => {
      if (loading) {
        refreshPending = true;
        return;
      }
      loading = true;
      do {
        refreshPending = false;
        try {
          const response = await fetchTestRecordsWithSensorReadings();
          if (active) {
            setRecordsError(response.error?.message ?? null);
            if (!response.error) setRecords(response.data);
          }
        } catch (error) {
          if (active) setRecordsError(error instanceof Error ? error.message : 'Unable to load saved sensor history.');
        } finally {
          if (active) setRecordsLoading(false);
        }
      } while (active && refreshPending);
      loading = false;
    };

    void load();
    const unsubscribeRecords = subscribeToTestRecordsChanged(() => void load());
    const unsubscribeReadings = subscribeToSensorReadingsChanged(() => void load());
    const interval = window.setInterval(() => void load(), 15000);
    return () => {
      active = false;
      unsubscribeRecords();
      unsubscribeReadings();
      window.clearInterval(interval);
    };
  }, [refreshVersion]);

  const history = useMemo(() => {
    const chronological = records.filter((record) => record.status !== 'RUNNING').reverse();
    const selected = Number.isFinite(historyRange) ? chronological.slice(-historyRange) : chronological;
    return selected.map((record): TestRecordWithSensorSummary & { chartLabel: string } => ({
      ...record,
      chartLabel: `#${record.test_id.slice(-6)}`,
    }));
  }, [records, historyRange]);

  const savedSeries = useMemo(() => ({
    windSpeed: toHistoricalPoints(history, (record) => record.wind_speed_kmh, (record) => record.wind_reading_recorded_at, (value) => value >= 0),
    windDirection: toHistoricalPoints(history, (record) => record.wind_direction_degrees, (record) => record.wind_reading_recorded_at, (value) => value >= 0 && value < 360),
    rainfall: toHistoricalPoints(history, (record) => record.rain_reading_24h, (record) => record.rain_reading_recorded_at, (value) => value >= 0),
    temperature: toHistoricalPoints(history, (record) => record.bmp280_temperature_c, (record) => record.bmp280_reading_recorded_at, (value) => value >= -40 && value <= 85),
    pressure: toHistoricalPoints(history, (record) => record.bmp280_pressure_hpa, (record) => record.bmp280_reading_recorded_at, (value) => value >= 300 && value <= 1100),
    uplift: toHistoricalPoints(history, (record) => record.uplift_force_n, (record) => record.load_cell_reading_recorded_at),
  }), [history]);

  const windLive = testActive && wind.connected && wind.windSpeedMps !== null && wind.windDirectionDeg !== null;
  const forceLive = testActive && loadCell.connected && loadCell.upliftForceN !== null;
  const bmp280AgeMs = bmp280.reading ? Date.now() - Date.parse(bmp280.reading.recorded_at) : Infinity;
  const bmp280Live = Boolean(bmp280.enabled && bmp280.reading && !bmp280.error && bmp280AgeMs >= -30_000 && bmp280AgeMs < 30_000);
  const rainLive = testActive && rain.source === 'hardware' && rain.connected && rain.rain24h !== null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Graphs and Analytics"
        subtitle="Live session telemetry and saved sensor readings grouped by test record."
        icon={<LineChartIcon className="h-5 w-5" />}
      />

      <section aria-label="Current sensor readings">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Current sensor readings</h2>
            <p className="mt-1 text-[10px] text-slate-500">Values are current only when the sensor reports a live reading.</p>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Live status</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CurrentReading label="Wind speed" value={windLive && wind.windSpeedMps !== null ? (wind.windSpeedMps * 3.6).toFixed(1) : '--'} unit="km/h" status={windLive ? 'LIVE' : !testActive ? 'UNAVAILABLE' : wind.recordedAt ? 'STALE DATA' : 'UNAVAILABLE'} icon={<Wind className="h-4 w-4" />} />
          <CurrentReading label="Wind direction" value={windLive && wind.windDirectionDeg !== null ? `${wind.windDirectionDeg.toFixed(1)}°` : '--'} unit="" status={windLive ? 'LIVE' : !testActive ? 'UNAVAILABLE' : wind.recordedAt ? 'STALE DATA' : 'UNAVAILABLE'} icon={<Compass className="h-4 w-4" />} />
          <CurrentReading label="Rainfall (24 h)" value={rainLive && rain.rain24h !== null ? rain.rain24h.toFixed(1) : '--'} unit="API unit" status={rainLive ? 'LIVE' : !testActive ? 'UNAVAILABLE' : rain.source === 'hardware' && rain.offline ? 'OFFLINE' : 'UNAVAILABLE'} icon={<CloudRain className="h-4 w-4" />} />
          <CurrentReading label="Temperature" value={bmp280Live && bmp280.reading ? bmp280.reading.temperature_c.toFixed(1) : '--'} unit="°C" status={!bmp280.enabled ? 'UNAVAILABLE' : bmp280Live ? 'LIVE' : bmp280.error ? 'OFFLINE' : bmp280.loading ? 'CONNECTING' : bmp280.reading ? 'STALE DATA' : 'UNAVAILABLE'} icon={<Thermometer className="h-4 w-4" />} />
          <CurrentReading label="Atmospheric pressure" value={bmp280Live && bmp280.reading ? bmp280.reading.pressure_hpa.toFixed(1) : '--'} unit="hPa" status={!bmp280.enabled ? 'UNAVAILABLE' : bmp280Live ? 'LIVE' : bmp280.error ? 'OFFLINE' : bmp280.loading ? 'CONNECTING' : bmp280.reading ? 'STALE DATA' : 'UNAVAILABLE'} icon={<Gauge className="h-4 w-4" />} />
          <CurrentReading label="Uplift force" value={forceLive && loadCell.upliftForceN !== null ? loadCell.upliftForceN.toFixed(2) : '--'} unit="N" status={forceLive ? 'LIVE' : !testActive ? 'UNAVAILABLE' : loadCell.recordedAt ? 'STALE DATA' : 'UNAVAILABLE'} icon={<Weight className="h-4 w-4" />} />
        </div>
      </section>

      <section aria-label="Live session trends">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-200">Live session trends</h2>
          <p className="mt-1 text-[10px] text-slate-500">Actual samples retained by the existing wind hook. Horizontal axis shows sample sequence, not elapsed time.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <LiveTrend title="Wind speed" icon={<Wind className="h-4 w-4" />} data={testActive ? wind.history : []} color="#00C8FF" unit="km/h" live={windLive} />
        </div>
      </section>

      <section aria-label="Saved historical sensor readings">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Saved test history</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Latest saved sensor reading per completed test record, ordered by test start. Each point stays tied to its test; exact sensor timestamp and test details appear in the tooltip.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Saved test range">
            {HISTORY_RANGES.map((range) => (
              <button
                key={range.label}
                type="button"
                onClick={() => setHistoryRange(range.value)}
                aria-pressed={historyRange === range.value}
                className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                  historyRange === range.value
                    ? 'border-accent-400/30 bg-accent-400/10 text-accent-300'
                    : 'border-base-600/70 bg-base-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {range.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRefreshVersion((version) => version + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-base-600/70 bg-base-900/60 px-3 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-slate-200"
              aria-label="Refresh saved sensor history"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>

        {recordsError && (
          <p role="alert" className="mb-3 rounded-lg border border-danger-400/20 bg-danger-400/[0.04] px-3 py-2 text-xs text-danger-300">
            Unable to load saved sensor history: {recordsError}
          </p>
        )}
        {recordsLoading ? (
          <div className="rounded-xl border border-base-600/70 bg-base-900/60 px-4 py-10 text-center text-xs text-slate-400">Loading saved sensor history…</div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-base-600/70 bg-base-900/60 px-4 py-10 text-center">
            <Activity className="mx-auto h-6 w-6 text-slate-600" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-300">No saved test history available</p>
            <p className="mt-1 text-xs text-slate-500">Historical trends appear here when sensor readings have been saved to test records.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HistoryChart title="Wind speed" data={savedSeries.windSpeed} color="#00C8FF" unit="km/h" icon={<Wind className="h-4 w-4" />} />
            <HistoryChart title="Wind direction" data={savedSeries.windDirection} color="#A78BFA" unit="°" direction icon={<Compass className="h-4 w-4" />} />
            <HistoryChart title="Rainfall (24 h)" data={savedSeries.rainfall} color="#38BDF8" unit="API unit" icon={<CloudRain className="h-4 w-4" />} />
            <HistoryChart title="BMP280 temperature" data={savedSeries.temperature} color="#F59E0B" unit="°C" icon={<Thermometer className="h-4 w-4" />} />
            <HistoryChart title="BMP280 atmospheric pressure" data={savedSeries.pressure} color="#00D6A0" unit="hPa" icon={<Gauge className="h-4 w-4" />} />
            <HistoryChart title="Uplift force" data={savedSeries.uplift} color="#22C55E" unit="N" icon={<Weight className="h-4 w-4" />} />
          </div>
        )}
      </section>
    </div>
  );
}

function toHistoricalPoints(
  records: Array<TestRecordWithSensorSummary & { chartLabel: string }>,
  getValue: (record: TestRecordWithSensorSummary) => number | null,
  getReadingAt: (record: TestRecordWithSensorSummary) => string | null,
  isValid: (value: number) => boolean = () => true,
): HistoricalPoint[] {
  return records.flatMap((record) => {
    const value = getValue(record);
    if (value === null || !Number.isFinite(value) || !isValid(value)) return [];
    const rawTimestamp = getReadingAt(record);
    const readingAt = rawTimestamp && Number.isFinite(Date.parse(rawTimestamp))
      ? new Date(rawTimestamp).toLocaleString()
      : null;
    return [{
      label: record.chartLabel,
      value,
      testId: record.test_id,
      scenario: record.scenario || '--',
      readingAt,
    }];
  });
}

function CurrentReading({ label, value, unit, status, icon }: {
  label: string;
  value: string;
  unit: string;
  status: 'LIVE' | 'DEMO DATA' | 'OFFLINE' | 'CONNECTING' | 'STALE DATA' | 'UNAVAILABLE';
  icon: React.ReactNode;
}) {
  const statusTone = status === 'LIVE' ? 'text-ok-300'
    : status === 'DEMO DATA' ? 'text-accent-300'
      : status === 'OFFLINE' ? 'text-danger-300'
        : status === 'CONNECTING' || status === 'STALE DATA' ? 'text-warn-300' : 'text-slate-500';
  return (
    <div className="min-w-0 rounded-xl border border-sky-200/10 bg-base-900/80 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 truncate text-xs font-medium text-slate-400">
          <span className="shrink-0 text-accent-300">{icon}</span>{label}
        </p>
        <span role="status" className={`shrink-0 text-[9px] font-bold tracking-wider ${statusTone}`}>{status}</span>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold text-slate-100">
        {value}{unit && <span className="ml-1.5 text-xs font-medium text-slate-400">{unit}</span>}
      </p>
      {status === 'DEMO DATA' && <p className="mt-1 text-[10px] text-accent-300">Fallback measurements are not plotted or shown as live readings.</p>}
    </div>
  );
}

function LiveTrend({ title, icon, data, color, unit, live }: {
  title: string;
  icon: React.ReactNode;
  data: TelemetryPoint[];
  color: string;
  unit: string;
  live: boolean;
}) {
  const points = data
    .filter((point) => Number.isFinite(point.value) && point.value >= 0)
    .map((point) => ({ label: `#${point.t}`, value: point.value * 3.6 }));
  return (
    <ChartPanel title={title} icon={icon} badge={live ? 'LIVE SESSION' : 'UNAVAILABLE'}>
      {points.length < 2 ? (
        <ChartEmpty text={points.length === 1 ? 'One live sample available; trend requires more readings.' : 'No live session samples available.'} />
      ) : (
        <SensorChart data={points} color={color} unit={unit} xLabel="Sample sequence" />
      )}
    </ChartPanel>
  );
}

function HistoryChart({ title, data, color, unit, icon, direction = false }: {
  title: string;
  data: HistoricalPoint[];
  color: string;
  unit: string;
  icon: React.ReactNode;
  direction?: boolean;
}) {
  return (
    <ChartPanel title={title} icon={icon} badge="SAVED HISTORY">
      {data.length === 0 ? (
        <ChartEmpty text="No saved readings for this sensor in the selected test records." />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryMetric label="Latest" value={formatReading(data[data.length - 1].value, unit)} />
            <SummaryMetric label="Minimum" value={formatReading(Math.min(...data.map((point) => point.value)), unit)} />
            <SummaryMetric label="Maximum" value={formatReading(Math.max(...data.map((point) => point.value)), unit)} />
            <SummaryMetric label="Average" value={formatReading(data.reduce((sum, point) => sum + point.value, 0) / data.length, unit)} />
          </div>
          <SensorChart
            data={data}
            color={color}
            unit={unit}
            xLabel="Test record"
            direction={direction}
            tooltipDetails={(point) => `Test ${point.testId} · ${point.scenario} · Reading recorded ${point.readingAt ?? 'time unavailable'}`}
          />
        </>
      )}
    </ChartPanel>
  );
}

function ChartPanel({ title, icon, badge, children }: {
  title: string;
  icon: React.ReactNode;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <Panel
      title={title}
      icon={icon}
      right={<span className={`text-[9px] font-bold tracking-wider ${badge === 'LIVE SESSION' ? 'text-ok-300' : badge === 'SAVED HISTORY' ? 'text-accent-300' : 'text-slate-500'}`}>{badge}</span>}
      className="min-w-0"
      bodyClassName="p-3 sm:p-4"
    >
      {children}
    </Panel>
  );
}

function SensorChart({ data, color, unit, xLabel, tooltipDetails, direction = false }: {
  data: Array<{ label: string; value: number; scenario?: string; testId?: string; readingAt?: string | null }>;
  color: string;
  unit: string;
  xLabel: string;
  tooltipDetails?: (point: { scenario?: string; testId?: string; readingAt?: string | null }) => string;
  direction?: boolean;
}) {
  const gradientId = `gradient-${color.replace('#', '')}`;
  return (
    <div className="h-56 w-full min-w-0 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        {direction ? (
          <RechartsLineChart data={data} margin={{ top: 12, right: 12, bottom: 16, left: 0 }}>
            <ChartAxes unit={unit} xLabel={xLabel} direction />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#CBD5E1', marginBottom: 4 }}
              formatter={(value: TooltipValueType | undefined) => [`${Number(value).toFixed(1)} ${unit}`, titleCaseUnit(unit)]}
              labelFormatter={(label, payload) => {
                const point = payload?.[0]?.payload as { scenario?: string; testId?: string; readingAt?: string | null } | undefined;
                return `${label}${point && tooltipDetails ? ` · ${tooltipDetails(point)}` : ''}`;
              }}
            />
            <Line type="linear" dataKey="value" name={titleCaseUnit(unit)} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </RechartsLineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 16, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <ChartAxes unit={unit} xLabel={xLabel} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#CBD5E1', marginBottom: 4 }}
              formatter={(value: TooltipValueType | undefined) => [`${Number(value).toFixed(2)} ${unit}`, titleCaseUnit(unit)]}
              labelFormatter={(label, payload) => {
                const point = payload?.[0]?.payload as { scenario?: string; testId?: string; readingAt?: string | null } | undefined;
                return `${label}${point && tooltipDetails ? ` · ${tooltipDetails(point)}` : ''}`;
              }}
            />
            <Area
              type="linear"
              dataKey="value"
              name={titleCaseUnit(unit)}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 4, strokeWidth: 0 }}
              dot={{ r: 2, fill: color, strokeWidth: 0 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function ChartAxes({ unit, xLabel, direction = false }: { unit: string; xLabel: string; direction?: boolean }) {
  const ticks = direction ? [0, 90, 180, 270, 360] : undefined;
  return (
    <>
      <CartesianGrid stroke="#26364D" strokeDasharray="3 5" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 9, fill: '#94A3B8' }}
        stroke="#26364D"
        tickLine={false}
        axisLine={{ stroke: '#26364D' }}
        interval="preserveStartEnd"
        minTickGap={24}
        label={{ value: xLabel, position: 'insideBottom', offset: -8, fontSize: 9, fill: '#64748B' }}
      />
      <YAxis
        tick={{ fontSize: 9, fill: '#94A3B8' }}
        stroke="#26364D"
        tickLine={false}
        axisLine={false}
        width={48}
        domain={direction ? [0, 360] : ['auto', 'auto']}
        ticks={ticks}
        tickFormatter={(value: number) => direction ? `${value}°` : Number(value).toFixed(1)}
        label={{ value: direction ? 'Direction (°)' : `Reading (${unit})`, angle: -90, position: 'insideLeft', fontSize: 9, fill: '#64748B', offset: 4 }}
      />
    </>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-base-600/60 bg-base-950/40 px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-200" title={value}>{value}</p>
    </div>
  );
}

function formatReading(value: number, unit: string): string {
  return `${value.toFixed(1)} ${unit}`.trim();
}

function titleCaseUnit(unit: string): string {
  switch (unit) {
    case 'km/h': return 'Wind speed';
    case '°': return 'Wind direction';
    case 'API unit': return 'Rainfall (24 h)';
    case '°C': return 'Temperature';
    case 'hPa': return 'Atmospheric pressure';
    case 'N': return 'Uplift force';
    case 'm/s': return 'Wind speed';
    default: return 'Reading';
  }
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-base-600/70 bg-base-950/30 px-4 text-center text-xs leading-relaxed text-slate-500 sm:h-64">
      {text}
    </div>
  );
}
