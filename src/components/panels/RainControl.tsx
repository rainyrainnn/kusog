import { CloudRain } from 'lucide-react';
import { Panel } from '../Panel';
import type { RainSensorData } from '@/lib/rainSensor';

export function RainControl({ sensor, sensorError, loading }: { sensor: RainSensorData; sensorError: string | null; loading: boolean }) {
  const rainDetected = sensor.rainState.toLowerCase() === 'rain';
  const status = loading
    ? 'LOADING'
    : sensorError
      ? 'ERROR'
      : sensor.connected
        ? rainDetected ? 'RAIN DETECTED' : sensor.rainState.toLowerCase() === 'normal' ? 'NO RAIN' : 'UNKNOWN'
        : sensor.offline ? 'OFFLINE' : 'WAITING';
  const statusColor = loading ? 'text-slate-400' : sensorError ? 'text-warn-400' : sensor.connected ? rainDetected ? 'text-warn-400' : 'text-ok-400' : sensor.offline ? 'text-danger-400' : 'text-slate-400';
  const hasReading = sensor.recordedAt !== null;

  return (
    <Panel title="Rain Sensor" icon={<CloudRain className="h-4 w-4" />} right={<span className="text-[10px] font-semibold uppercase tracking-wider text-accent-400">Live · Read only</span>} className="h-full">
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
          <span className="text-right font-mono text-slate-300">{hasReading && sensor.rain24h !== null ? sensor.rain24h : '—'}</span>
          <span className="text-slate-500">Battery Percentage</span>
          <span className="text-right font-mono text-slate-300">{hasReading && sensor.batteryPercentage !== null ? `${sensor.batteryPercentage}%` : '—'}</span>
          <span className="text-slate-500">Sensor</span>
          <span className={`text-right font-semibold ${sensor.connected ? 'text-ok-400' : sensorError ? 'text-warn-400' : sensor.offline ? 'text-danger-400' : 'text-slate-400'}`}>{loading ? 'LOADING' : sensorError ? 'ERROR' : sensor.connected ? 'CONNECTED' : sensor.offline ? 'DISCONNECTED' : 'WAITING'}</span>
        </div>
        <p className="text-[10px] text-slate-600">Last Updated {sensor.recordedAt ? new Date(sensor.recordedAt).toLocaleString() : '—'}</p>
        {loading && <p className="text-[10px] text-slate-400">Loading latest reading from Supabase...</p>}
        {!loading && sensorError && <p role="alert" className="text-[10px] text-warn-400/80">Unable to load rain sensor data: {sensorError}</p>}
        {!loading && !sensorError && !sensor.connected && <p className="text-[10px] text-slate-500">{sensor.offline ? sensor.recordedAt ? 'No recent reading from Raspberry Pi.' : 'No readings received within the offline timeout.' : 'Waiting for the first rain sensor reading.'}</p>}
      </div>
    </Panel>
  );
}
