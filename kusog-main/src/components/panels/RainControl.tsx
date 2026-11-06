import { CloudRain } from 'lucide-react';
import { Panel } from '../Panel';
import type { RainSensorData } from '@/lib/rainSensor';
import { isRainDetected } from '@/lib/rainSensorParsing';
import type { RainSensorReading } from '@/lib/rainSensorReadings';

export function RainControl({ sensor, sensorError, loading, reading, readingLoading, readingError, recordId }: {
  sensor: RainSensorData;
  sensorError: string | null;
  loading: boolean;
  reading: RainSensorReading | null;
  readingLoading: boolean;
  readingError: string | null;
  recordId: string | null;
}) {
  const isSimulationActive = recordId !== null;
  const displayedRainState = reading?.rain_state ?? (sensor.connected ? sensor.rainState : null);
  const rainDetected = displayedRainState ? isRainDetected(displayedRainState) : false;
  const hasReading = isSimulationActive && (reading !== null || sensor.connected);
  const status = !recordId
    ? 'Start simulation to view readings'
    : readingError
      ? 'DATABASE ERROR'
      : reading
        ? rainDetected ? 'RAIN DETECTED' : reading.rain_state.toUpperCase()
        : sensor.connected
          ? rainDetected ? 'RAIN DETECTED · UPLOAD PENDING' : `${sensor.rainState.toUpperCase()} · UPLOAD PENDING`
          : readingLoading ? 'LOADING READING' : 'NO READING YET';
  const statusColor = !recordId || readingLoading
    ? 'text-slate-400'
    : readingError
      ? 'text-danger-400'
      : reading
        ? rainDetected ? 'text-warn-400' : 'text-ok-400'
        : sensor.connected
          ? rainDetected ? 'text-warn-400' : 'text-ok-400'
        : 'text-slate-400';
  const connectionStatus = loading
    ? 'CONNECTING'
    : sensorError || sensor.offline
      ? 'OFFLINE'
      : sensor.connected ? 'CONNECTED' : 'WAITING';

  return (
    <Panel
      title="Tuya Rain Sensor"
      icon={<CloudRain className="h-4 w-4" />}
      right={<span className={`text-[10px] font-semibold uppercase tracking-wider ${connectionStatus === 'CONNECTED' ? 'text-ok-400' : connectionStatus === 'OFFLINE' ? 'text-danger-400' : 'text-accent-400'}`}>{connectionStatus}</span>}
      className="h-full"
    >
      <div className="flex h-full flex-col justify-center gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">Rain Status</span>
          <span className={`text-right text-xs font-bold ${statusColor}`}>{status}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">Rain Level</span>
          <span className="font-mono text-sm font-bold text-slate-200">
            {hasReading ? reading?.rain_level ?? sensor.rainLevel : '—'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-base-700/70 pt-2 text-xs">
          <span className="text-slate-500">Rain State</span>
          <span className="text-right font-mono text-slate-300">{hasReading ? reading?.rain_state ?? sensor.rainState : '—'}</span>
          <span className="text-slate-500">Rain 24h</span>
          <span className="text-right font-mono text-slate-300">
            {hasReading && (reading?.rain_24h ?? sensor.rain24h) !== null
              ? `${reading?.rain_24h ?? sensor.rain24h} (API unit)`
              : '—'}
          </span>
          <span className="text-slate-500">Battery Percentage</span>
          <span className="text-right font-mono text-slate-300">
            {hasReading && (reading?.battery_percentage ?? sensor.batteryPercentage) !== null
              ? `${reading?.battery_percentage ?? sensor.batteryPercentage}%`
              : '—'}
          </span>
          <span className="text-slate-500">Sensor Source</span>
          <span className={`text-right font-semibold ${connectionStatus === 'CONNECTED' ? 'text-ok-400' : 'text-slate-400'}`}>
            {connectionStatus}
          </span>
          {hasReading && reading && (
            <>
              <span className="text-slate-500">Last database update</span>
              <span className="text-right font-mono text-slate-300">{new Date(reading.recorded_at).toLocaleString()}</span>
            </>
          )}
        </div>
        {!recordId && sensor.connected && <p className="text-[10px] text-slate-500">Sensor is connected. Start the simulation to display its Supabase readings.</p>}
        {recordId && readingLoading && <p className="text-[10px] text-slate-400">Loading this simulation&apos;s rain reading from Supabase...</p>}
        {recordId && !reading && sensor.connected && !readingError && (
          <p className="text-[10px] text-slate-500">Showing the live Tuya reading while waiting for its Supabase upload.</p>
        )}
        {recordId && !readingLoading && !reading && !sensor.connected && !readingError && <p className="text-[10px] text-slate-500">No rain reading uploaded for this simulation yet.</p>}
        {recordId && readingError && <p role="alert" className="text-[10px] text-danger-400">Unable to load rain reading from Supabase: {readingError}</p>}
        {sensorError && <p role="alert" className="text-[10px] text-warn-400/80">Unable to check Tuya sensor connection: {sensorError}</p>}
      </div>
    </Panel>
  );
}
