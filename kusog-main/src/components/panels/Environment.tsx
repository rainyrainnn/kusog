
import { Compass, Gauge, Wind, CloudRain, Weight } from 'lucide-react';
import { Panel, StatusDot } from '../Panel';
import type { WindPoint, WindSensorData } from '@/lib/windSensor';
import type { LoadCellData } from '@/lib/loadCell';
import type { RainSensorData } from '@/lib/rainSensor';
import { useBMP280Sensor } from '@/lib/bmp280Sensor';
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

export function SensorMonitoring({ active, wind, loadCell, rain, rainLoading, windHistory }: {
  active: boolean;
  wind: WindSensorData;
  loadCell: LoadCellData;
  rain: RainSensorData;
  rainLoading: boolean;
  windHistory: WindPoint[];
}) {
  const bmp280 = useBMP280Sensor();
  const windStatus: SensorStatus = !active
    ? 'UNAVAILABLE'
    : wind.connected ? 'LIVE'
      : wind.recordedAt ? 'STALE DATA' : 'UNAVAILABLE';
  const loadCellStatus: SensorStatus = !active
    ? 'UNAVAILABLE'
    : loadCell.connected ? 'LIVE'
      : loadCell.recordedAt ? 'STALE DATA' : 'UNAVAILABLE';
  const rainStatus: SensorStatus = rain.source === 'hardware' && rain.connected
      ? 'LIVE'
      : rain.source === 'hardware' && rain.offline
        ? 'OFFLINE'
        : rainLoading ? 'CONNECTING' : 'UNAVAILABLE';

  const validWindTime = active && wind.recordedAt ? formatSensorTime(wind.recordedAt) : null;
  const validLoadCellTime = active && loadCell.recordedAt ? formatSensorTime(loadCell.recordedAt) : null;
  const bmp280AgeMs = bmp280.reading ? Date.now() - Date.parse(bmp280.reading.recorded_at) : null;
  const bmp280Fresh = Boolean(bmp280.reading && bmp280AgeMs !== null && bmp280AgeMs >= -30_000 && bmp280AgeMs < 30_000);
  const bmp280Reading = bmp280Fresh ? bmp280.reading : null;
  const bmp280Status: SensorStatus = bmp280.error
    ? 'OFFLINE'
    : bmp280.reading && !bmp280Fresh
      ? 'STALE DATA'
      : bmp280Reading ? 'LIVE' : bmp280.loading ? 'CONNECTING' : 'UNAVAILABLE';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SensorValueCard
          icon={Wind}
          label="Wind speed"
          value={active && wind.windSpeedMps !== null ? (wind.windSpeedMps * 3.6).toFixed(1) : '--'}
          unit="km/h"
          status={windStatus}
          updatedAt={validWindTime}
          detail={!active ? 'Start a simulation to view readings.' : windStatus === 'STALE DATA' ? 'Last available reading is stale.' : undefined}
        />
        <SensorValueCard
          icon={Compass}
          label="Wind direction"
          value={active && wind.windDirectionDeg !== null ? `${wind.windDirectionDeg.toFixed(1)}° ${compassDirection(wind.windDirectionDeg)}` : '--'}
          unit=""
          status={windStatus}
          updatedAt={validWindTime}
          detail={!active ? 'Start a simulation to view readings.' : undefined}
        />
        <SensorValueCard
          icon={CloudRain}
          label="Rainfall (24 h)"
          value={rainStatus === 'LIVE' && rain.rain24h !== null ? rain.rain24h.toFixed(1) : '--'}
          unit="API unit"
          status={rainStatus}
          updatedAt={rainStatus === 'LIVE' && rain.recordedAt ? formatSensorTime(rain.recordedAt) : null}
          detail={rainStatus === 'LIVE' ? `Rain level: ${rain.rainLevel || '--'} · unit not specified by API` : undefined}
        />
        <BMP280Card
          status={bmp280Status}
          temperature={bmp280Reading ? bmp280Reading.temperature_c.toFixed(1) : '--'}
          pressure={bmp280Reading ? bmp280Reading.pressure_hpa.toFixed(1) : '--'}
          updatedAt={bmp280Reading ? formatSensorTime(bmp280Reading.recorded_at) : null}
          detail={bmp280.error
            ? `Unable to load BMP280 readings from Supabase: ${bmp280.error}`
            : bmp280.reading && !bmp280Fresh
              ? 'Last BMP280 reading is older than the 30-second freshness window.'
              : !bmp280Reading && bmp280.loading
                ? 'Loading the latest BMP280 reading from Supabase.'
                : !bmp280Reading
                  ? 'No BMP280 readings found in Supabase.'
                  : undefined}
        />
        <SensorValueCard
          icon={Weight}
          label="Uplift force"
          value={active && loadCell.upliftForceN !== null ? loadCell.upliftForceN.toFixed(2) : '--'}
          unit="N"
          status={loadCellStatus}
          updatedAt={validLoadCellTime}
          detail={!active ? 'Start a simulation to view readings.' : loadCellStatus === 'STALE DATA' ? 'Last available reading is stale.' : undefined}
        />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4">
        <SensorTrend
          title="Wind speed trend"
          icon={Wind}
          data={active ? windHistory.map((point) => ({ t: point.t, value: point.value * 3.6 })) : []}
          unit="km/h"
          color="#00C8FF"
          emptyText="Wind samples will appear when recorded during an active simulation."
        />
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        Values and trends use existing sensor readings. Rainfall demo fallback values are not presented as live measurements.
      </p>
    </div>
  );
}

type SensorStatus = 'LIVE' | 'DEMO DATA' | 'OFFLINE' | 'CONNECTING' | 'STALE DATA' | 'UNAVAILABLE';

function SensorValueCard({ icon: Icon, label, value, unit, status, updatedAt, detail }: {
  icon: typeof Wind;
  label: string;
  value: string;
  unit: string;
  status: SensorStatus;
  updatedAt: string | null;
  detail?: string;
}) {
  const statusStyles: Record<SensorStatus, { text: string; dot: 'ok' | 'warn' | 'danger' }> = {
    LIVE: { text: 'text-ok-300', dot: 'ok' },
    'DEMO DATA': { text: 'text-accent-300', dot: 'warn' },
    OFFLINE: { text: 'text-danger-300', dot: 'danger' },
    CONNECTING: { text: 'text-warn-300', dot: 'warn' },
    'STALE DATA': { text: 'text-warn-300', dot: 'warn' },
    UNAVAILABLE: { text: 'text-slate-400', dot: 'warn' },
  };
  const style = statusStyles[status];

  return (
    <article className="min-w-0 rounded-xl border border-sky-200/10 bg-base-900/80 p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sky-200/10 bg-base-800/80 text-accent-300">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="truncate text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">{label}</h2>
        </div>
        <span role="status" className={`inline-flex shrink-0 items-center gap-1.5 text-[9px] font-bold tracking-wider ${style.text}`}>
          <StatusDot color={style.dot} pulse={status === 'LIVE'} />
          {status}
        </span>
      </div>

      <p className="mt-5 font-mono text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
        {value}
        {unit && <span className="ml-2 text-sm font-medium text-slate-400">{unit}</span>}
      </p>
      <div className="mt-4 min-h-10 border-t border-sky-200/10 pt-2.5">
        <p className="text-[10px] text-slate-500">
          Last update{updatedAt ? ` · ${updatedAt}` : ' · --'}
        </p>
        {detail && <p className="mt-1 break-words text-[10px] leading-relaxed text-slate-500">{detail}</p>}
      </div>
    </article>
  );
}

function BMP280Card({ status, temperature, pressure, updatedAt, detail }: {
  status: SensorStatus;
  temperature: string;
  pressure: string;
  updatedAt: string | null;
  detail?: string;
}) {
  const statusStyles: Record<SensorStatus, { text: string; dot: 'ok' | 'warn' | 'danger' }> = {
    LIVE: { text: 'text-ok-300', dot: 'ok' },
    'DEMO DATA': { text: 'text-accent-300', dot: 'warn' },
    OFFLINE: { text: 'text-danger-300', dot: 'danger' },
    CONNECTING: { text: 'text-warn-300', dot: 'warn' },
    'STALE DATA': { text: 'text-warn-300', dot: 'warn' },
    UNAVAILABLE: { text: 'text-slate-400', dot: 'warn' },
  };
  const style = statusStyles[status];

  return (
    <article className="min-w-0 rounded-xl border border-sky-200/10 bg-base-900/80 p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sky-200/10 bg-base-800/80 text-accent-300">
            <Gauge className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="truncate text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">BMP280 temperature &amp; pressure</h2>
        </div>
        <span role="status" className={`inline-flex shrink-0 items-center gap-1.5 text-[9px] font-bold tracking-wider ${style.text}`}>
          <StatusDot color={style.dot} pulse={status === 'LIVE'} />
          {status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">Temperature</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            {temperature}<span className="ml-1.5 text-sm font-medium text-slate-400">°C</span>
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">Atmospheric pressure</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            {pressure}<span className="ml-1.5 text-sm font-medium text-slate-400">hPa</span>
          </p>
        </div>
      </div>

      <div className="mt-4 min-h-10 border-t border-sky-200/10 pt-2.5">
        <p className="text-[10px] text-slate-500">Last update{updatedAt ? ` · ${updatedAt}` : ' · --'}</p>
        {detail && <p className="mt-1 break-words text-[10px] leading-relaxed text-slate-500">{detail}</p>}
      </div>
    </article>
  );
}

function SensorTrend({ title, icon: Icon, data, unit, color, emptyText }: {
  title: string;
  icon: typeof Wind;
  data: WindPoint[];
  unit: string;
  color: string;
  emptyText: string;
}) {
  const gradientId = `environment-trend-${color.slice(1)}`;
  return (
    <Panel title={title} icon={<Icon className="h-4 w-4" />} className="min-w-0" bodyClassName="p-3 sm:p-4">
      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-base-600/70 bg-base-950/30 px-5 text-center">
          <p className="max-w-sm text-xs leading-relaxed text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="h-44 min-w-0" aria-label={`${title} in ${unit} from existing sensor samples`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#26364D" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#94A3B8' }} stroke="#26364D" tickLine={false} axisLine={false} tickFormatter={(value) => `#${value}`} minTickGap={28} />
              <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} stroke="#26364D" tickLine={false} axisLine={false} width={44} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0B1220', border: '1px solid #26364D', borderRadius: '8px', fontSize: '11px', color: '#F5F8FC' }}
                labelFormatter={(value) => `Sample #${value}`}
                formatter={(value: TooltipValueType | undefined) => [typeof value === 'number' ? `${value.toFixed(1)} ${unit}` : '--', title]}
              />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-[9px] text-slate-500">Recorded session samples · {unit}</p>
    </Panel>
  );
}

function formatSensorTime(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

function compassDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % directions.length];
}
