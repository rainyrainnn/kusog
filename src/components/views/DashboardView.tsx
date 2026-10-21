import type { Simulation } from '@/hooks/useSimulation';
import type { RouteId } from '@/components/Sidebar';
import { fmtClock, fmtDate, fmtElapsed } from '@/hooks/useSimulation';
import { Activity, Compass, Droplets, Weight, Wind } from 'lucide-react';
import { CameraFeed } from '@/components/panels/CameraFeed';
import { RainControl } from '@/components/panels/RainControl';
import { WindDirection } from '@/components/panels/WindDirection';
import { Environment } from '@/components/panels/Environment';
import { StructuralStatus } from '@/components/panels/StructuralStatus';
import { ForceGraph } from '@/components/panels/Graphs';
import { TestLog } from '@/components/panels/TestLog';
import { AiAssessment } from '@/components/panels/AiAssessment';
import { ReportGeneration } from '@/components/panels/ReportGeneration';
import { HouseSetup } from '@/components/panels/HouseSetup';
import type { RainSensorData } from '@/lib/rainSensor';
import { useSystemStatus } from '@/hooks/useSystemStatus';

type DashboardViewProps = {
  sim: Simulation;
  rainSensor: RainSensorData;
  sensorError: string | null;
  sensorLoading: boolean;
  onNavigate: (r: RouteId) => void;
};

export function DashboardView({ sim, rainSensor, sensorError, sensorLoading, onNavigate }: DashboardViewProps) {
  const system = useSystemStatus();
  const rainValue = rainSensor.connected ? rainSensor.rainLevel : '—';
  const currentTestState = sim.testStatus;
  const testStatusColor = sim.isTestRunning
    ? 'bg-ok-500/15 text-ok-400'
    : sim.testStatus === 'COMPLETED'
      ? 'bg-sky-500/15 text-sky-300'
      : sim.testStatus === 'FAILED' || sim.testStatus === 'SAVE PENDING'
        ? 'bg-danger-500/15 text-danger-400'
        : 'bg-slate-700/70 text-slate-300';
  const formatTimestamp = (value: string | null | undefined) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : `${fmtDate(date)} ${fmtClock(date)}`;
  };

  return (
    <div className="space-y-3.5">
      <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <CameraFeed onExpand={() => onNavigate('camera')} />
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:col-span-5 lg:gap-2">
          <section className="min-w-0 rounded-md border border-sky-300/15 bg-base-900/90 p-3 shadow-panel backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Activity className="h-4 w-4 text-accent-300" /> Chamber Status
              </div>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${testStatusColor}`}>
                {currentTestState}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
              <StatusValue label="Edge service" value={system.raspberryPi} />
              <StatusValue label="YOLO model" value={system.yolo} />
              <StatusValue label="Edge camera" value={system.webcam} />
              <StatusValue label="Supabase" value={system.supabase} />
            </div>
          </section>
          <section className="min-w-0 rounded-md border border-sky-300/15 bg-base-900/90 p-3 shadow-panel backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-100">Current Test</h2>
              <span className={`text-[10px] font-bold ${sim.isTestRunning ? 'text-ok-400' : sim.testStatus === 'COMPLETED' ? 'text-sky-300' : sim.testStatus === 'FAILED' || sim.testStatus === 'SAVE PENDING' ? 'text-danger-400' : 'text-slate-400'}`}>{currentTestState}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <TestValue label="Test ID" value={sim.testRecord?.test_id ?? (sim.isTestRunning ? sim.testId : 'No test recorded')} />
              <TestValue label="Scenario" value={sim.testRecord?.scenario ?? '—'} />
              <TestValue label="Started" value={formatTimestamp(sim.testRecord?.start_time)} />
              <TestValue label="Ended" value={formatTimestamp(sim.testRecord?.end_time)} />
              <TestValue label="Elapsed" value={fmtElapsed(sim.elapsed)} />
              <TestValue label="Result" value={sim.testResult} />
              <TestValue label="Wind Speed" value={sim.testRecord?.wind_speed === null || sim.testRecord?.wind_speed === undefined ? '—' : `${sim.testRecord.wind_speed} km/h`} />
              <TestValue label="Uplift Force" value={sim.testRecord?.current_force === null || sim.testRecord?.current_force === undefined ? '—' : `${sim.testRecord.current_force} N`} />
            </dl>
          </section>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric icon={Wind} label="Wind speed" value={sim.windSensorConnected ? `${(sim.windSpeed * 3.6).toFixed(1)} km/h` : 'Unavailable'} detail={sim.windSensorConnected ? 'Live sensor' : 'Wind sensor offline'} state={sim.windSensorConnected ? 'live' : 'offline'} />
        <Metric icon={Compass} label="Wind direction" value={sim.windSensorConnected ? `${Math.round(sim.windDir)}°` : 'Unavailable'} detail={sim.windSensorConnected ? 'Live sensor' : 'Wind sensor offline'} state={sim.windSensorConnected ? 'live' : 'offline'} />
        <Metric icon={Droplets} label="Rain level" value={rainValue} detail={sensorLoading ? 'Loading from Supabase' : rainSensor.connected ? 'Live sensor' : sensorError ? 'Reading error' : rainSensor.offline ? 'Sensor offline' : 'Waiting for data'} state={rainSensor.connected ? 'live' : 'offline'} />
        <Metric icon={Weight} label="Uplift force" value={sim.loadCellConnected ? `${sim.currentForce.toFixed(1)} N` : 'Unavailable'} detail={sim.loadCellConnected ? 'Live load cell' : 'Load cell offline'} state={sim.loadCellConnected ? 'live' : 'offline'} />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <ForceGraph sim={sim} />
        </div>
        <div className="min-w-0 xl:col-span-4">
          <RainControl sensor={rainSensor} sensorError={sensorError} loading={sensorLoading} />
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="min-w-0">
          <WindDirection sim={sim} />
        </div>
        <div className="min-w-0">
          <Environment />
        </div>
        <div className="min-w-0">
          <StructuralStatus />
        </div>
        <div className="min-w-0">
          <HouseSetup sim={sim} />
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-5">
          <TestLog sim={sim} />
        </div>
        <div className="min-w-0 xl:col-span-4">
          <AiAssessment sim={sim} />
        </div>
        <div className="min-w-0 xl:col-span-3">
          <ReportGeneration sim={sim} />
        </div>
      </div>
    </div>
  );
}

function StatusValue({ label, value }: { label: string; value: 'online' | 'offline' | 'pending' | string }) {
  const connected = value === 'online';
  const pending = value === 'pending';
  return (
    <div className="min-w-0 border-l border-sky-200/15 pl-2.5">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={`truncate text-xs font-semibold ${connected ? 'text-ok-400' : pending ? 'text-warn-400' : 'text-slate-300'}`}>
        {value === 'online' ? 'Connected' : value === 'offline' ? 'Offline' : value === 'pending' ? 'Checking' : value}
      </p>
    </div>
  );
}

function TestValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] text-slate-400">{label}</dt>
      <dd className="truncate font-mono text-xs text-slate-100">{value}</dd>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, state }: {
  icon: typeof Wind;
  label: string;
  value: string;
  detail: string;
  state: 'live' | 'offline';
}) {
  return (
    <section className="min-w-0 rounded-md border border-sky-300/15 bg-base-900/90 p-3 shadow-panel backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sky-400/10 text-accent-300"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="truncate text-[10px] text-slate-300">{label}</p>
          <p className={`truncate font-mono text-base font-bold ${state === 'live' ? 'text-white' : 'text-slate-400'}`}>{value}</p>
        </div>
      </div>
      <p className={`mt-2 truncate text-[9px] uppercase tracking-wide ${state === 'live' ? 'text-ok-400' : 'text-slate-400'}`}>{detail}</p>
    </section>
  );
}
