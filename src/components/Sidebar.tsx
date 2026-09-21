import {
  LayoutDashboard,
  Camera,
  CloudSun,
  SlidersHorizontal,
  LineChart,
  BrainCircuit,
  ScrollText,
  FileText,
  Settings,
  Pause,
  Play,
  Octagon,
} from 'lucide-react';
import type { Simulation } from '@/hooks/useSimulation';
import { fmtClock, fmtElapsed } from '@/hooks/useSimulation';
import { StatusDot } from './Panel';

export type RouteId =
  | 'dashboard'
  | 'camera'
  | 'environment'
  | 'controls'
  | 'graphs'
  | 'ai'
  | 'log'
  | 'reports'
  | 'settings';

const NAV: { id: RouteId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'camera', label: 'Live Camera', icon: Camera },
  { id: 'environment', label: 'Environment', icon: CloudSun },
  { id: 'controls', label: 'Controls', icon: SlidersHorizontal },
  { id: 'graphs', label: 'Graphs', icon: LineChart },
  { id: 'ai', label: 'AI Assessment', icon: BrainCircuit },
  { id: 'log', label: 'Test Log', icon: ScrollText },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ sim, route, onNavigate }: { sim: Simulation; route: RouteId; onNavigate: (r: RouteId) => void }) {
  const running = sim.isTestRunning;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-base-600/70 bg-base-850/80">
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Navigation
        </p>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = route === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-accent-500/15 text-accent-400 shadow-[inset_2px_0_0_0_#0ea5e9]'
                      : 'text-slate-400 hover:bg-base-700/60 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{item.label}</span>
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-400 shadow-glow-accent" />}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Current Test card */}
        <div className="mt-5 rounded-xl border border-base-600/70 bg-base-800/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Current Test
            </span>
            <span
              className="flex items-center gap-1.5 rounded-full px-2 py-0.5"
              style={{ background: running ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)' }}
            >
              <StatusDot color={running ? 'ok' : 'danger'} pulse={running} />
              <span className={`text-[10px] font-bold tracking-wider ${running ? 'text-ok-400' : 'text-danger-400'}`}>
                {running ? 'RUNNING' : 'STOPPED'}
              </span>
            </span>
          </div>
          <dl className="space-y-1.5 text-xs">
            <Row label="Test ID" value={running ? sim.testId : '---'} mono />
            <Row label="Start Time" value={running && sim.startTime ? fmtClock(sim.startTime) : '--:--:--'} mono />
            <Row label="Elapsed" value={fmtElapsed(sim.elapsed)} mono accent={running} />
            <div>
              <dt className="text-slate-500">Scenario</dt>
              <dd className="mt-0.5 rounded bg-base-700/60 px-2 py-1 font-medium text-slate-200">
                {running ? sim.scenario : 'Standby'}
              </dd>
            </div>
          </dl>
        </div>
      </nav>

      {/* Start / Stop button */}
      <div className="border-t border-base-600/70 p-3">
        {running ? (
          <button
            onClick={sim.stopTest}
            className="group flex w-full items-center justify-center gap-2 rounded-lg border border-danger-500/40 bg-danger-500/15 py-3 text-sm font-bold uppercase tracking-widest text-danger-400 shadow-glow-danger transition hover:bg-danger-500 hover:text-white"
          >
            <Pause className="h-4 w-4" />
            Stop Test
            <Octagon className="h-3.5 w-3.5 opacity-60 transition group-hover:opacity-100" />
          </button>
        ) : (
          <button
            onClick={sim.startTest}
            className="group flex w-full items-center justify-center gap-2 rounded-lg border border-ok-500/40 bg-ok-500/15 py-3 text-sm font-bold uppercase tracking-widest text-ok-400 shadow-glow-ok transition hover:bg-ok-500 hover:text-white"
          >
            <Play className="h-4 w-4" />
            Start Test
          </button>
        )}
        <p className="mt-2 text-center text-[10px] text-slate-600">
          {running ? 'Emergency halt — all systems' : 'Initialize new test sequence'}
        </p>
      </div>
    </aside>
  );
}

function Row({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`truncate ${mono ? 'font-mono' : ''} ${accent ? 'text-accent-400' : 'text-slate-200'}`}>
        {value}
      </dd>
    </div>
  );
}
