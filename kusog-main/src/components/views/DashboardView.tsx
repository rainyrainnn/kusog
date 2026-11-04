import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BrainCircuit,
  Camera,
  ChevronRight,
  Clock3,
  CloudRain,
  Compass,
  Cpu,
  Database,
  Gauge,
  Radio,
  Thermometer,
  Weight,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type { Simulation } from '@/hooks/useSimulation';
import type { RouteId } from '@/components/Sidebar';
import { fmtElapsed } from '@/hooks/useSimulation';
import { CameraFeed } from '@/components/panels/CameraFeed';
import { RainControl } from '@/components/panels/RainControl';
import { WindDirection } from '@/components/panels/WindDirection';
import { StructuralStatus } from '@/components/panels/StructuralStatus';
import { ForceGraph } from '@/components/panels/Graphs';
import { TestLog } from '@/components/panels/TestLog';
import { ReportGeneration } from '@/components/panels/ReportGeneration';
import { HouseSetup } from '@/components/panels/HouseSetup';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import type { RainSensorData } from '@/lib/rainSensor';
import { useSystemStatus, type ConnectionStatus } from '@/hooks/useSystemStatus';
import { useYoloDetections } from '@/hooks/useYoloDetections';
import type { EdgeDetectionResponse, EdgeHealth } from '@/lib/edgeService';
import { hasDamageClasses } from '@/lib/edgeService';
import { useBMP280Sensor } from '@/lib/bmp280Sensor';
import {
  fetchTestRecords,
  subscribeToTestRecordsChanged,
  type TestRecord,
} from '@/lib/testRecords';

type DashboardViewProps = {
  sim: Simulation;
  rainSensor: RainSensorData;
  sensorError: string | null;
  sensorLoading: boolean;
  onNavigate: (r: RouteId) => void;
};

type Tone = 'online' | 'demo' | 'offline' | 'stale' | 'pending' | 'error' | 'inactive' | 'neutral';

const TONE_STYLES: Record<Tone, string> = {
  online: 'border-ok-400/20 bg-ok-400/[0.08] text-ok-400',
  demo: 'border-accent-400/20 bg-accent-400/[0.08] text-accent-300',
  offline: 'border-slate-400/15 bg-slate-400/[0.06] text-slate-400',
  stale: 'border-warn-400/20 bg-warn-400/[0.08] text-warn-400',
  pending: 'border-warn-400/20 bg-warn-400/[0.08] text-warn-400',
  error: 'border-danger-400/20 bg-danger-400/[0.08] text-danger-400',
  inactive: 'border-slate-400/15 bg-slate-400/[0.06] text-slate-500',
  neutral: 'border-sky-200/10 bg-slate-400/[0.05] text-slate-300',
};

function ToneBadge({ label, tone, dot = false }: { label: string; tone: Tone; dot?: boolean }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${TONE_STYLES[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'online' ? 'bg-ok-400' : tone === 'demo' ? 'bg-accent-300' : tone === 'error' || tone === 'offline' ? 'bg-danger-400' : tone === 'pending' || tone === 'stale' ? 'bg-warn-400' : 'bg-slate-500'} ${tone === 'online' ? 'animate-pulse' : ''}`} />}
      <span className="truncate">{label}</span>
    </span>
  );
}

function testResult(record: TestRecord | null): string {
  if (!record) return '—';
  if (record.status === 'FAILED' || record.ai_overall === 'DAMAGE DETECTED') return 'FAILED';
  if (record.status === 'RUNNING') return 'IN PROGRESS';
  if (record.status === 'COMPLETED') return 'NOT ASSESSED';
  return record.status.replace(/_/g, ' ');
}

function resultTone(record: TestRecord | null): Tone {
  const result = testResult(record);
  if (result === 'FAILED') return 'error';
  if (result === 'IN PROGRESS') return 'pending';
  return 'neutral';
}

function recordDuration(record: TestRecord): string {
  return record.duration_seconds === null ? '—' : fmtElapsed(record.duration_seconds);
}

function formatRecordDate(value: string | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

function compassPoint(degrees: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
}

export function DashboardView({ sim, rainSensor, sensorError, sensorLoading, onNavigate }: DashboardViewProps) {
  const system = useSystemStatus();
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const isSimulationActive = (sim.isDevicesActive || sim.isTestRunning) && !sim.isFinalizing;
  const bmp280 = useBMP280Sensor();
  const recordYoloAssessment = sim.recordYoloAssessment;
  const handleYoloResult = useCallback((health: EdgeHealth, result: EdgeDetectionResponse) => {
    const analysisReady = health.status === 'ok'
      && (health.modelReady ?? Boolean(health.model))
      && health.camera === 'online';
    recordYoloAssessment(result.detections, analysisReady, health.classes ?? []);
  }, [recordYoloAssessment]);
  const yolo = useYoloDetections(isSimulationActive, handleYoloResult);

  useEffect(() => {
    let active = true;
    let loading = false;
    let refreshPending = false;

    const loadRecords = async () => {
      if (loading) {
        refreshPending = true;
        return;
      }
      loading = true;
      do {
        refreshPending = false;
        try {
          const response = await fetchTestRecords();
          if (active) {
            setRecordsError(response.error?.message ?? null);
            if (!response.error) setRecords(response.data);
            setRecordsLoading(false);
          }
        } catch (error) {
          if (active) {
            setRecordsError(error instanceof Error ? error.message : 'Unable to load recent test activity.');
            setRecordsLoading(false);
          }
        }
      } while (active && refreshPending);
      loading = false;
    };

    void loadRecords();
    const unsubscribe = subscribeToTestRecordsChanged(() => void loadRecords());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const latestResultRecord = records.find((record) => record.status !== 'RUNNING') ?? null;
  const currentTestId = sim.isTestRunning ? sim.testId || sim.testRecord?.test_id || null : null;
  const currentStatus = sim.isRestoring
    ? 'CHECKING SESSION'
    : sim.isStarting
      ? 'STARTING'
      : sim.isFinalizing
        ? 'FINALIZING'
        : sim.hasPendingFinalization
          ? 'SAVE PENDING'
          : sim.isTestRunning
            ? 'RUNNING'
            : sim.testRecord?.status ?? 'STANDBY';
  const currentTone: Tone = sim.isTestRunning
    ? sim.isFinalizing ? 'pending' : 'online'
    : sim.isStarting || sim.isRestoring || sim.isFinalizing
      ? 'pending'
      : sim.hasPendingFinalization || sim.testRecord?.status === 'FAILED'
        ? 'error'
        : 'neutral';
  const windAvailable = sim.windSensorConnected;
  const rainTone: Tone = rainSensor.source === 'inactive'
      ? 'inactive'
      : rainSensor.connected
        ? 'online'
        : sensorLoading
          ? 'pending'
          : sensorError || rainSensor.offline
            ? 'offline'
            : 'inactive';

  const bmp280AgeMs = bmp280.reading ? Date.now() - Date.parse(bmp280.reading.recorded_at) : Infinity;
  const bmp280Fresh = Boolean(bmp280.reading && !bmp280.error && bmp280AgeMs >= -30_000 && bmp280AgeMs < 30_000);
  const bmp280Tone: Tone = bmp280.error
    ? 'offline'
    : bmp280Fresh
      ? 'online'
      : bmp280.loading
        ? 'pending'
        : bmp280.reading
          ? 'stale'
          : 'inactive';
  const bmp280Temperature = bmp280Fresh ? bmp280.reading?.temperature_c : null;
  const bmp280Pressure = bmp280Fresh ? bmp280.reading?.pressure_hpa : null;
  const bmp280Detail = bmp280.error
    ? `Supabase error: ${bmp280.error}`
    : bmp280.loading
      ? 'Loading BMP280 readings from Supabase…'
      : bmp280.reading
        ? `${bmp280Tone === 'stale' ? 'STALE · ' : ''}BMP280 · Recorded at ${formatRecordDate(bmp280.reading.recorded_at)}`
        : 'No BMP280 readings found in Supabase.';

  return (
    <div className="space-y-6 sm:space-y-7">
      <PageHeader
        title="Dashboard"
        subtitle="Scientific monitoring for chamber conditions, active tests, and connected systems."
        icon={<Activity className="h-5 w-5" />}
        right={
          <div className="flex min-w-0 flex-col items-end gap-1.5">
            <ToneBadge label={currentStatus} tone={currentTone} dot />
            {currentTestId && (
              <span className="max-w-40 truncate font-mono text-[9px] text-slate-400 sm:max-w-56" title={currentTestId}>
                {currentTestId}
              </span>
            )}
          </div>
        }
      />

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <CameraFeed onExpand={() => onNavigate('camera')} isSimulationRunning={isSimulationActive} yolo={yolo} />
        </div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:col-span-5 xl:grid-cols-1">
          <AiSummary sim={sim} active={isSimulationActive} yolo={yolo} yoloStatus={system.yolo} />
        </div>
      </div>

      <Panel
        title="Simulation Overview"
        icon={<Gauge className="h-4 w-4" />}
        right={<span className="hidden text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:inline">Current session</span>}
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <OverviewValue label="Current status" value={currentStatus} tone={currentTone} />
          <OverviewValue label="Test scenario" value={sim.testRecord?.scenario || '--'} />
          <OverviewValue
            label="Elapsed duration"
            value={sim.isTestRunning
              ? fmtElapsed(sim.elapsed)
              : sim.testRecord?.duration_seconds !== null && sim.testRecord?.duration_seconds !== undefined
                ? fmtElapsed(sim.testRecord.duration_seconds)
                : '--'}
            mono
          />
          <OverviewValue label="Last test result" value={testResult(latestResultRecord)} tone={resultTone(latestResultRecord)} />
        </div>
      </Panel>

      <SystemHealth
        system={{
          raspberryPi: system.raspberryPi,
          camera: isSimulationActive ? system.webcam : 'inactive',
          yolo: isSimulationActive ? system.yolo : 'inactive',
          supabase: system.supabase,
        }}
        sensors={[
          { label: 'Wind sensor', status: isSimulationActive ? windAvailable ? 'online' : 'offline' : 'inactive', detail: windAvailable ? 'LIVE DATA' : isSimulationActive ? 'No recent reading' : 'Waiting for active test', icon: Wind },
          { label: 'Uplift load cell', status: isSimulationActive ? sim.loadCellConnected ? 'online' : 'offline' : 'inactive', detail: sim.loadCellConnected ? 'LIVE DATA' : isSimulationActive ? 'No recent reading' : 'Waiting for active test', icon: Weight },
          { label: 'Rain sensor', status: rainTone, detail: rainTone === 'online' ? 'LIVE DATA · Hardware' : rainTone === 'pending' ? 'Checking sensor' : rainTone === 'offline' ? 'No hardware reading' : 'Inactive', icon: CloudRain },
          { label: 'BMP280', status: bmp280Tone, detail: bmp280Detail, icon: Thermometer },
        ]}
      />

      <section aria-label="Live sensor summary">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-100">Environmental Readings</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Values are sourced from existing sensors; stale, demo, and unavailable states are labeled.</p>
          </div>
          {isSimulationActive && <ToneBadge label="TEST SESSION ACTIVE" tone="online" dot />}
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
          <MetricCard
            icon={Wind}
            label="Wind speed"
            value={windAvailable ? `${(sim.windSpeed * 3.6).toFixed(1)} km/h` : '--'}
            detail={windAvailable ? 'Wind sensor' : isSimulationActive ? 'Wind sensor' : 'Waiting for test'}
            tone={windAvailable ? 'online' : isSimulationActive ? 'offline' : 'inactive'}
          />
          <MetricCard
            icon={Compass}
            label="Wind direction"
            value={windAvailable ? `${Math.round(sim.windDir)}° ${compassPoint(sim.windDir)}` : '--'}
            detail={windAvailable ? 'Wind sensor' : isSimulationActive ? 'Wind sensor' : 'Waiting for test'}
            tone={windAvailable ? 'online' : isSimulationActive ? 'offline' : 'inactive'}
          />
          <MetricCard
            icon={CloudRain}
            label="Rainfall · 24 h"
            value={rainSensor.connected && rainSensor.rain24h !== null
              ? rainSensor.rain24h.toFixed(1)
              : '--'}
            detail={rainSensor.connected
              ? `${rainSensor.rainLevel || 'Rain sensor'} · hardware · API unit`
              : rainSensor.source === 'inactive'
                ? 'Waiting for test'
                : sensorLoading
                  ? 'Checking sensor'
                  : sensorError ? 'Rain sensor error' : 'Rain sensor unavailable'}
            tone={rainTone}
          />
          <MetricCard
            icon={Thermometer}
            label="Temperature"
            value={bmp280Temperature === null || bmp280Temperature === undefined ? '--' : `${bmp280Temperature.toFixed(1)} °C`}
            detail={bmp280Detail}
            tone={bmp280Tone}
          />
          <MetricCard
            icon={Gauge}
            label="Atmospheric pressure"
            value={bmp280Pressure === null || bmp280Pressure === undefined ? '--' : `${bmp280Pressure.toFixed(1)} hPa`}
            detail={bmp280Detail}
            tone={bmp280Tone}
          />
          <MetricCard
            icon={Weight}
            label="Uplift force"
            value={sim.loadCellConnected ? `${sim.currentForce.toFixed(1)} N` : '--'}
            detail={sim.loadCellConnected ? 'Load cell' : isSimulationActive ? 'Load cell' : 'Waiting for test'}
            tone={sim.loadCellConnected ? 'online' : isSimulationActive ? 'offline' : 'inactive'}
          />
        </div>
        {bmp280.error && (
          <p role="alert" className="mt-2 break-words text-[10px] text-danger-400">
            Unable to load BMP280 readings from Supabase: {bmp280.error}
          </p>
        )}
      </section>

      <Panel
        title="Recent Test Activity"
        icon={<Clock3 className="h-4 w-4" />}
        right={
          <button type="button" onClick={() => onNavigate('log')} className="flex items-center gap-1 text-[10px] font-semibold text-accent-300 transition-colors hover:text-accent-100">
            Test records <ChevronRight className="h-3.5 w-3.5" />
          </button>
        }
        bodyClassName="p-0"
      >
        {recordsError ? (
          <p role="alert" className="px-4 py-5 text-xs text-danger-400">Unable to load recent tests: {recordsError}</p>
        ) : recordsLoading ? (
          <p className="px-4 py-5 text-xs text-slate-400">Loading test activity…</p>
        ) : records.length === 0 ? (
          <p className="px-4 py-5 text-xs text-slate-400">No test records are available yet.</p>
        ) : (
          <div className="divide-y divide-sky-200/[0.07]">
            {records.slice(0, 4).map((record) => (
              <article key={record.id} className="grid min-w-0 grid-cols-2 items-center gap-2 px-4 py-3 transition-colors hover:bg-white/[0.02] sm:grid-cols-[minmax(0,1.8fr)_minmax(100px,1fr)_minmax(90px,0.8fr)_minmax(90px,0.8fr)]">
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <p className="break-all font-mono text-xs font-semibold text-slate-100">{record.test_id || 'Test ID unavailable'}</p>
                  <p className="mt-1 truncate text-[10px] text-slate-400">{record.scenario || 'Scenario unavailable'} · {formatRecordDate(record.start_time)}</p>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <ToneBadge
                    label={record.status.replace(/_/g, ' ')}
                    tone={record.status === 'RUNNING' ? 'online' : record.status === 'FAILED' ? 'error' : 'neutral'}
                    dot
                  />
                </div>
                <div className="text-[10px] text-slate-400">
                  Duration <span className="ml-1 font-mono text-slate-200">{recordDuration(record)}</span>
                </div>
                <div className="justify-self-start sm:justify-self-end">
                  <ToneBadge label={testResult(record)} tone={resultTone(record)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8"><ForceGraph sim={sim} /></div>
        <div className="min-w-0 xl:col-span-4"><RainControl sensor={rainSensor} sensorError={sensorError} loading={sensorLoading} /></div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0"><WindDirection sim={sim} /></div>
        <div className="min-w-0"><StructuralStatus /></div>
        <div className="min-w-0"><HouseSetup sim={sim} /></div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7"><TestLog sim={sim} /></div>
        <div className="min-w-0 xl:col-span-5"><ReportGeneration /></div>
      </div>
    </div>
  );
}

function OverviewValue({ label, value, tone = 'neutral', mono = false }: { label: string; value: string; tone?: Tone; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-base-700/70 bg-base-950/35 px-3 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1.5 break-words text-sm font-semibold ${mono ? 'font-mono' : ''} ${tone === 'online' ? 'text-ok-400' : tone === 'error' ? 'text-danger-400' : tone === 'pending' ? 'text-warn-400' : 'text-slate-100'}`} title={value}>
        {value}
      </p>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-sky-200/10 bg-base-900/90 p-3 shadow-panel transition-[border-color,background-color] duration-200 hover:border-accent-400/25 hover:bg-base-850/95 sm:p-4">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-accent-400/15 bg-accent-400/[0.08] text-accent-300">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <p className="min-w-0 text-[10px] font-semibold uppercase leading-snug tracking-[0.1em] text-slate-400">{label}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold tracking-wide ${TONE_STYLES[tone]}`}>
          {tone === 'online' ? 'LIVE' : tone === 'demo' ? 'DEMO DATA' : tone === 'offline' ? 'OFFLINE' : tone === 'stale' ? 'STALE' : tone === 'pending' ? 'CONNECTING' : tone === 'error' ? 'ERROR' : tone === 'inactive' ? 'UNAVAILABLE' : '--'}
        </span>
      </div>
      <p className="mt-4 break-words font-mono text-xl font-semibold tracking-tight text-slate-100 transition-colors duration-300 sm:text-2xl" aria-live="polite">
        {value}
      </p>
      <p className="mt-2 min-h-7 break-words text-[9px] leading-relaxed text-slate-500">{detail}</p>
    </article>
  );
}

function AiSummary({ sim, active, yolo, yoloStatus }: {
  sim: Simulation;
  active: boolean;
  yolo: ReturnType<typeof useYoloDetections>;
  yoloStatus: ConnectionStatus;
}) {
  const health = yolo.health;
  const modelReady = Boolean(health && health.status === 'ok' && (health.modelReady ?? Boolean(health.model)));
  const cameraReady = health?.camera === 'online';
  const ready = active && modelReady && cameraReady;
  const damageAssessmentSupported = hasDamageClasses(health?.classes);
  const detections = active ? yolo.result?.detections ?? null : null;
  const latestDetection = detections?.[detections.length - 1] ?? null;
  const assessment = !active
    ? { label: 'INACTIVE', tone: 'inactive' as Tone }
    : !ready
      ? { label: yolo.loading ? 'CONNECTING' : 'UNAVAILABLE', tone: yolo.loading ? 'pending' as Tone : 'offline' as Tone }
      : !damageAssessmentSupported
        ? { label: 'NOT ASSESSED', tone: 'neutral' as Tone }
        : sim.aiDetections.overall === 'DAMAGE DETECTED'
          ? { label: 'DAMAGE DETECTED', tone: 'error' as Tone }
          : { label: 'NOT ASSESSED', tone: 'neutral' as Tone };
  const serviceTone: Tone = !active
    ? 'inactive'
    : yoloStatus === 'online'
      ? 'online'
      : yoloStatus === 'pending' || yolo.loading
        ? 'pending'
        : yoloStatus === 'error'
          ? 'error'
          : 'offline';

  return (
    <Panel title="AI Assessment" icon={<BrainCircuit className="h-4 w-4" />} right={<ToneBadge label={active ? yoloStatus.toUpperCase() : 'IDLE'} tone={serviceTone} dot />} className="h-full">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="min-w-0 rounded-lg border border-base-700/60 bg-base-950/35 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Model</p>
          <p className="mt-1.5 truncate font-mono text-xs font-semibold text-slate-200" title={active ? health?.model || 'Model name unavailable' : 'Inactive'}>
            {active ? health?.model || (modelReady ? 'Loaded model' : '—') : '—'}
          </p>
          <p className="mt-1 text-[9px] text-slate-500">{!active ? 'Inactive' : modelReady ? 'Model ready' : yolo.loading ? 'Checking model' : 'Not ready'}</p>
        </div>
        <div className="min-w-0 rounded-lg border border-base-700/60 bg-base-950/35 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Detections</p>
          <p className="mt-1.5 font-mono text-lg font-semibold text-slate-100">{detections ? detections.length : '—'}</p>
          <p className="mt-1 text-[9px] text-slate-500">{detections ? 'Latest service result' : active ? 'Waiting for result' : 'Inactive'}</p>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-base-700/60 bg-base-950/35 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-slate-400">Latest detection</span>
          {latestDetection && <span className="shrink-0 font-mono text-[10px] text-ok-400">{(latestDetection.confidence * 100).toFixed(1)}%</span>}
        </div>
        <p className="mt-1.5 truncate text-sm font-semibold text-slate-100">
          {latestDetection ? latestDetection.className : detections ? 'No objects detected' : active ? 'Waiting for live result' : '—'}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-sky-200/10 pt-3">
        <span className="text-[10px] font-medium text-slate-400">Structural assessment</span>
        <ToneBadge label={assessment.label} tone={assessment.tone} />
      </div>
      {active && ready && !damageAssessmentSupported && (
        <p className="mt-2 text-[9px] leading-relaxed text-warn-400">The available model classes do not support structural-damage assessment.</p>
      )}
      {active && !ready && yolo.error && <p className="mt-2 break-words text-[9px] leading-relaxed text-slate-500">{yolo.error}</p>}
    </Panel>
  );
}

function SystemHealth({ system, sensors }: {
  system: { raspberryPi: Tone | ConnectionStatus; camera: Tone | ConnectionStatus; yolo: Tone | ConnectionStatus; supabase: Tone | ConnectionStatus };
  sensors: { label: string; status: Tone | ConnectionStatus; detail: string; icon: LucideIcon }[];
}) {
  const services = [
    { label: 'Raspberry Pi', status: system.raspberryPi, icon: Cpu },
    { label: 'USB camera', status: system.camera, icon: Camera },
    { label: 'YOLO AI service', status: system.yolo, icon: BrainCircuit },
    { label: 'Supabase', status: system.supabase, icon: Database },
  ];

  return (
    <Panel title="System Health" icon={<Radio className="h-4 w-4" />}>
      <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
        {services.map(({ label, status, icon: Icon }) => (
          <HealthRow key={label} label={label} icon={Icon} status={status} />
        ))}
      </div>
      <div className="my-3 border-t border-sky-200/10" />
      <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Available sensors</p>
      <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
        {sensors.map(({ label, status, detail, icon }) => (
          <HealthRow key={label} label={label} icon={icon} status={status} detail={detail} />
        ))}
      </div>
    </Panel>
  );
}

function HealthRow({ label, icon: Icon, status, detail }: {
  label: string;
  icon: LucideIcon;
  status: Tone | ConnectionStatus;
  detail?: string;
}) {
  const tone: Tone = status === 'online' ? 'online'
    : status === 'demo' ? 'demo'
      : status === 'pending' ? 'pending'
        : status === 'error' ? 'error'
          : status === 'stale' ? 'stale'
            : status === 'inactive' ? 'inactive'
              : status === 'offline' ? 'offline'
                : 'neutral';
  const labelStatus = status === 'online' ? 'ONLINE'
    : status === 'demo' ? 'DEMO DATA'
      : status === 'pending' ? 'CHECKING'
        : status === 'error' ? 'ERROR'
          : status === 'stale' ? 'STALE'
            : status === 'inactive' ? 'INACTIVE'
              : status === 'offline' ? 'OFFLINE'
                : '—';

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-base-700/50 bg-base-950/25 px-2.5 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-medium text-slate-300">{label}</p>
        {detail && <p className="mt-0.5 truncate text-[9px] text-slate-500">{detail}</p>}
      </div>
      <span className={`shrink-0 text-[8px] font-bold uppercase tracking-[0.08em] ${tone === 'online' ? 'text-ok-400' : tone === 'demo' ? 'text-accent-300' : tone === 'pending' || tone === 'stale' ? 'text-warn-400' : tone === 'error' ? 'text-danger-400' : tone === 'offline' ? 'text-slate-400' : 'text-slate-500'}`}>
        {labelStatus}
      </span>
    </div>
  );
}
