import { CloudRain } from 'lucide-react';
import { Panel } from '../Panel';
import type { RainSensorData } from '@/lib/rainSensor';

export function RainControl({ sensor, sensorError, loading }: {
  sensor: RainSensorData;
  sensorError: string | null;
  loading: boolean;
}) {
  const inactive = sensor.source === 'inactive';
  const rainDetected = sensor.rainState.toLowerCase() === 'rain';
  const hasReading = !inactive && sensor.connected;
  const status = inactive
    ? 'Rain sensor inactive.'
    : loading
        ? 'CONNECTING'
        : sensorError
          ? 'ERROR'
          : sensor.connected
            ? rainDetected ? 'RAIN DETECTED' : sensor.rainState.toLowerCase() === 'normal' ? 'NO RAIN' : 'UNKNOWN'
            : sensor.offline ? 'OFFLINE' : 'WAITING';
  const statusColor = inactive
    ? 'text-slate-400'
    : loading
      ? 'text-slate-400'
      : sensorError
        ? 'text-warn-400'
        : sensor.connected
          ? rainDetected ? 'text-warn-400' : 'text-ok-400'
          : sensor.offline ? 'text-danger-400' : 'text-slate-400';

  return (
    <Panel
      title="Rain Sensor"
      icon={<CloudRain className="h-4 w-4" />}
      right={<span className="text-[10px] font-semibold uppercase tracking-wider text-accent-400">{inactive ? 'OFF' : sensor.connected ? 'HARDWARE' : 'MONITORING'}</span>}
      className="h-full"
    >
      <div className="flex h-full flex-col justify-center gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">Rain Status</span>
          <span className={`text-right text-xs font-bold ${statusColor}`}>{status}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">Rain Level</span>
          <span className="font-mono text-sm font-bold text-slate-200">{hasReading ? sensor.rainLevel : '—'}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-base-700/70 pt-2 text-xs">
          <span className="text-slate-500">Rain State</span>
          <span className="text-right font-mono text-slate-300">{hasReading ? sensor.rainState : '—'}</span>
          <span className="text-slate-500">Rain 24h</span>
          <span className="text-right font-mono text-slate-300">{hasReading && sensor.rain24h !== null ? `${sensor.rain24h} (API unit)` : '—'}</span>
          <span className="text-slate-500">Battery Percentage</span>
          <span className="text-right font-mono text-slate-300">{hasReading && sensor.batteryPercentage !== null ? `${sensor.batteryPercentage}%` : '—'}</span>
          <span className="text-slate-500">Sensor Source</span>
          <span className={`text-right font-semibold ${sensor.connected ? 'text-ok-400' : 'text-slate-400'}`}>
            {inactive ? 'INACTIVE' : loading ? 'CONNECTING' : sensor.connected ? 'CONNECTED' : sensor.offline ? 'DISCONNECTED' : 'WAITING'}
          </span>
        </div>
        {inactive && <p className="text-[10px] text-slate-500">Rain sensor inactive.</p>}
        {!inactive && loading && <p className="text-[10px] text-slate-400">Checking the rain sensor after simulation start...</p>}
        {!inactive && sensorError && <p role="alert" className="text-[10px] text-warn-400/80">Unable to load rain sensor data: {sensorError}</p>}
      </div>
    </Panel>
  );
}
