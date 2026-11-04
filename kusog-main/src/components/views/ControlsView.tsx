import { useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CloudRain,
  Compass,
  Gauge,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Square,
  Weight,
  Wind,
} from 'lucide-react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import { RainControl } from '@/components/panels/RainControl';
import type { Simulation } from '@/hooks/useSimulation';
import { fmtElapsed, windLabel } from '@/hooks/useSimulation';
import type { RainSensorData } from '@/lib/rainSensor';

type ControlsViewProps = {
  sim: Simulation;
  rainSensor: RainSensorData;
  sensorError: string | null;
  sensorLoading: boolean;
};

export function ControlsView({ sim, rainSensor, sensorError, sensorLoading }: ControlsViewProps) {
  const [stopRequestPending, setStopRequestPending] = useState(false);
  const running = sim.isTestRunning;
  const canStart = !sim.isRestoring && !sim.isStarting && !running && !sim.isFinalizing
    && !sim.hasPendingStart && !sim.hasPendingFinalization;
  const canStop = running && !sim.isFinalizing && !sim.hasPendingFinalization && !stopRequestPending;
  const status = sim.isRestoring
    ? 'CHECKING SESSION'
    : sim.isStarting
      ? sim.hasPendingStart ? 'RETRYING START' : 'STARTING'
      : sim.isFinalizing
        ? 'STOPPING · SAVING'
        : sim.hasPendingFinalization
          ? 'SAVE PENDING'
          : running ? 'RUNNING'
            : sim.testRecord?.status === 'FAILED' ? 'FAILED'
              : sim.testRecord?.status === 'COMPLETED' ? 'COMPLETED' : 'IDLE';
  const statusTone = status === 'RUNNING' ? 'text-ok-300'
    : status === 'SAVE PENDING' || status === 'FAILED' ? 'text-danger-300'
      : status === 'IDLE' ? 'text-slate-400'
        : status === 'COMPLETED' ? 'text-ok-300' : 'text-warn-300';
  const displayTestId = running ? sim.testId : sim.testRecord?.test_id || '--';
  const currentDuration = running ? fmtElapsed(sim.elapsed) : sim.testRecord?.duration_seconds != null
    ? fmtElapsed(sim.testRecord.duration_seconds)
    : '--:--:--';
  const retryMessage = sim.hasPendingStart
    ? 'The test record could not be created. Retry to use the pending record request.'
    : sim.hasPendingFinalization
      ? 'The test has stopped but its final record could not be saved. Retry saving to complete finalization.'
      : null;

  const startOrRetry = () => {
    if (sim.hasPendingStart) void sim.retryStart();
    else void sim.startTest();
  };

  const stopAndSave = async () => {
    if (!canStop) return;
    setStopRequestPending(true);
    try {
      await sim.stopTest();
    } finally {
      setStopRequestPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Simulation Controls"
        subtitle="Manage the test-session lifecycle and monitor connected environmental readings."
        icon={<SlidersHorizontal className="h-5 w-5" />}
      />

      <Panel
        title="Simulation overview & actions"
        icon={<Activity className="h-4 w-4" />}
        right={
          <span role="status" aria-live="polite" className={`inline-flex max-w-full items-center gap-2 rounded-full border border-sky-200/10 bg-base-950/50 px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] ${statusTone}`}>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status === 'RUNNING' ? 'bg-ok-400' : status === 'SAVE PENDING' || status === 'FAILED' ? 'bg-danger-400' : status === 'IDLE' ? 'bg-slate-500' : status === 'COMPLETED' ? 'bg-ok-400' : 'bg-warn-400'}`} />
            {status}
          </span>
        }
        bodyClassName="p-3 sm:p-5"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SessionMetric label={running ? 'Elapsed duration' : 'Last test duration'} value={currentDuration} icon={<Clock3 className="h-4 w-4" />} />
          <SessionMetric label={running ? 'Active Test ID' : 'Most recent Test ID'} value={displayTestId} icon={<Activity className="h-4 w-4" />} mono />
        </div>

        <div className="mt-3 flex flex-col gap-3 border-t border-sky-200/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-300">
              {running
                ? 'Simulation running.'
                : sim.hasPendingFinalization ? 'Test stopped; final save requires retry.'
                  : sim.isRestoring ? 'Checking for an active test session…'
                    : sim.isStarting ? 'Creating the test record before activating the session.'
                      : sim.testRecord?.status === 'FAILED' ? 'The most recent test failed.'
                        : sim.testRecord?.status === 'COMPLETED' ? 'The most recent test is saved.'
                          : 'Ready to start a new simulation.'}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Stopping opens a confirmation and then finalizes the active test record. Pause and resume are not supported by this session lifecycle.
            </p>
          </div>
          <div className="grid w-full shrink-0 grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
            {sim.hasPendingFinalization ? (
              <button
                type="button"
                onClick={() => void sim.retryFinalize()}
                disabled={sim.isFinalizing}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-warn-300/30 bg-warn-300/[0.08] px-4 py-2 text-xs font-bold text-warn-200 transition-colors hover:bg-warn-300/[0.14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn-300 disabled:cursor-wait disabled:opacity-50"
                aria-busy={sim.isFinalizing}
              >
                <RefreshCw className={`h-4 w-4 ${sim.isFinalizing ? 'animate-spin' : ''}`} aria-hidden="true" />
                {sim.isFinalizing ? 'Saving test…' : 'Retry save'}
              </button>
            ) : running ? (
              <button
                type="button"
                onClick={() => void stopAndSave()}
                disabled={!canStop}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-danger-300/30 bg-danger-300/[0.08] px-4 py-2 text-xs font-bold text-danger-200 transition-colors hover:bg-danger-300/[0.15] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-300 disabled:cursor-wait disabled:opacity-50"
                aria-busy={stopRequestPending || sim.isFinalizing}
              >
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                {stopRequestPending || sim.isFinalizing ? 'Stopping and saving…' : 'Stop and save'}
              </button>
            ) : (
              <button
                type="button"
                onClick={startOrRetry}
                disabled={!canStart}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-accent-300/30 bg-accent-300/[0.08] px-4 py-2 text-xs font-bold text-accent-200 transition-colors hover:bg-accent-300/[0.15] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300 disabled:cursor-wait disabled:opacity-50"
                aria-busy={sim.isStarting}
              >
                {sim.isStarting
                  ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : <Play className="h-4 w-4" aria-hidden="true" />}
                {sim.isRestoring ? 'Checking session…' : sim.isStarting ? sim.hasPendingStart ? 'Retrying start…' : 'Creating test…' : sim.hasPendingStart ? 'Retry start' : 'Start simulation'}
              </button>
            )}
          </div>
        </div>

        {sim.persistenceError && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-danger-400/20 bg-danger-400/[0.05] p-3 text-xs text-danger-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{sim.persistenceError}</span>
          </div>
        )}
        {retryMessage && !sim.persistenceError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-warn-400/20 bg-warn-400/[0.04] p-3 text-xs text-warn-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{retryMessage}</span>
          </div>
        )}
        {sim.testRecord?.status === 'COMPLETED' && !running && !sim.hasPendingFinalization && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-ok-400/20 bg-ok-400/[0.04] p-3 text-xs text-ok-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Test record saved. {sim.testResult}
          </p>
        )}
        {sim.testRecord?.status === 'FAILED' && !running && !sim.hasPendingFinalization && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-danger-400/20 bg-danger-400/[0.04] p-3 text-xs text-danger-200">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            The most recent test record is marked failed.
          </p>
        )}
      </Panel>

      <Panel title="Current sensor readings · read only" icon={<Gauge className="h-4 w-4" />}>
        <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
          These values report available sensor measurements; they are not operator-adjustable chamber output settings. This page does not provide fan-speed or wind/rain control commands.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OperatingValue
            label="Wind speed"
            value={running && sim.windSensorConnected ? `${sim.windSpeed.toFixed(2)} m/s` : '--'}
            detail={running && sim.windSensorConnected ? windLabel(sim.windSpeed * 3.6) : 'Unavailable'}
            icon={<Wind className="h-4 w-4" />}
          />
          <OperatingValue
            label="Wind direction"
            value={running && sim.windSensorConnected ? `${sim.windDir.toFixed(1)}°` : '--'}
            detail={running && sim.windSensorConnected ? 'Measured sensor value' : 'Unavailable'}
            icon={<Compass className="h-4 w-4" />}
          />
          <OperatingValue
            label="Uplift force"
            value={running && sim.loadCellConnected ? `${sim.currentForce.toFixed(2)} N` : '--'}
            detail={running && sim.loadCellConnected ? 'Measured load-cell value' : 'Unavailable'}
            icon={<Weight className="h-4 w-4" />}
          />
          <OperatingValue
            label="Rainfall (24 h)"
            value={rainSensor.source === 'hardware' && rainSensor.connected && rainSensor.rain24h !== null ? rainSensor.rain24h.toFixed(1) : '--'}
            detail={rainSensor.source === 'hardware' && rainSensor.connected ? 'Connected hardware reading · API unit' : 'Unavailable'}
            icon={<CloudRain className="h-4 w-4" />}
          />
          <OperatingValue label="Fan setting" value="--" detail="No operator fan control is available." icon={<Activity className="h-4 w-4" />} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RainControl sensor={rainSensor} sensorError={sensorError} loading={sensorLoading} />
        <Panel title="Hardware & session readiness" icon={<Activity className="h-4 w-4" />}>
          <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
            Sensor states reflect the existing reading hooks. Edge inference receives start/stop requests with the test lifecycle; its connection and model health are not confirmed by these controls.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReadinessItem
              label="Wind sensor"
              status={!running ? 'IDLE' : sim.windSensorConnected ? 'LIVE' : 'UNAVAILABLE'}
            />
            <ReadinessItem
              label="Uplift load cell"
              status={!running ? 'IDLE' : sim.loadCellConnected ? 'LIVE' : 'UNAVAILABLE'}
            />
            <ReadinessItem
              label="Rain sensor"
              status={rainSensor.source === 'hardware' && rainSensor.connected ? 'LIVE' : rainSensor.source === 'hardware' && rainSensor.offline ? 'OFFLINE' : sensorLoading ? 'CONNECTING' : 'UNAVAILABLE'}
            />
            <ReadinessItem
              label="Test record"
              status={running && sim.testRecord?.id ? 'READY' : sim.isStarting ? 'CONNECTING' : sim.hasPendingStart ? 'SAVE PENDING' : sim.testRecord?.status === 'COMPLETED' ? 'COMPLETED' : sim.testRecord?.status === 'FAILED' ? 'FAILED' : sim.isRestoring ? 'CONNECTING' : 'IDLE'}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SessionMetric({ label, value, icon, mono = false }: {
  label: string;
  value: string;
  icon: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-sky-200/10 bg-base-950/40 p-3">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        <span className="text-accent-300">{icon}</span>{label}
      </p>
      <p className={`mt-2 truncate text-sm font-semibold text-slate-100 ${mono ? 'font-mono' : ''}`} title={value}>{value}</p>
    </div>
  );
}

function OperatingValue({ label, value, detail, icon }: {
  label: string;
  value: string;
  detail?: string;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-sky-200/10 bg-base-950/30 p-3">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span className="text-accent-300">{icon}</span>{label}
      </p>
      <p className="mt-2 truncate font-mono text-sm font-semibold text-slate-100" title={value}>{value}</p>
      {detail && <p className="mt-1 truncate text-[10px] text-slate-500" title={detail}>{detail}</p>}
    </div>
  );
}

function ReadinessItem({ label, status }: {
  label: string;
  status: 'LIVE' | 'DEMO DATA' | 'OFFLINE' | 'STALE DATA' | 'CONNECTING' | 'UNAVAILABLE' | 'READY' | 'SAVE PENDING' | 'COMPLETED' | 'FAILED' | 'IDLE';
}) {
  const tone = status === 'LIVE' || status === 'READY' || status === 'COMPLETED' ? 'text-ok-300'
    : status === 'DEMO DATA' ? 'text-accent-300'
      : status === 'OFFLINE' || status === 'FAILED' ? 'text-danger-300'
        : status === 'STALE DATA' || status === 'CONNECTING' || status === 'SAVE PENDING' ? 'text-warn-300' : 'text-slate-500';
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-sky-200/10 bg-base-950/30 px-3 py-2.5">
      <span className="truncate text-xs text-slate-400">{label}</span>
      <span className={`shrink-0 text-[9px] font-bold tracking-wider ${tone}`}>{status}</span>
    </div>
  );
}
