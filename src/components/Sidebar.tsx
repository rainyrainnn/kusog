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
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { Simulation } from '@/hooks/useSimulation';
import { KusogLogo } from '@/components/KusogLogo';

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
  const canStart = !sim.isStarting && !sim.isRestoring && !sim.isFinalizing && !sim.hasPendingFinalization && !sim.isTestRunning;
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = (id: RouteId) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <aside className="storm-sidebar z-20 flex w-full shrink-0 flex-col border-b border-sky-200/15 text-white md:w-60 md:border-b-0 md:border-r">
      <div className="hidden items-center gap-2.5 border-b border-sky-200/15 px-4 py-3 md:flex">
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-sky-300/20 bg-slate-950/50">
          <KusogLogo className="h-12 w-12" />
        </span>
        <span className="min-w-0">
          <span className="block font-mono text-sm font-extrabold tracking-wider text-white">KUSOG</span>
          <span className="block text-[9px] leading-tight text-slate-300">Smart Typhoon<br />Simulation Chamber</span>
        </span>
      </div>
      <div className="flex min-h-12 items-center justify-between px-4 md:hidden">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">Control Navigation</span>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          className="grid h-9 w-9 place-items-center rounded-md border border-sky-200/20 bg-slate-950/40 text-slate-100"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>
      <nav className={`${mobileOpen ? 'block' : 'hidden'} min-w-0 flex-1 overflow-y-auto px-3 pb-3 md:block md:py-4`}>
        <p className="hidden px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60 md:block">
          Navigation
        </p>
        <ul className="flex min-w-0 flex-col gap-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = route === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => navigate(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-sky-500/15 text-white shadow-[inset_3px_0_0_0_#22d3ee]'
                      : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="whitespace-nowrap font-medium">{item.label}</span>
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-300" />}
                </button>
              </li>
            );
          })}
        </ul>

      </nav>

      {/* Start / Stop button */}
      <div className="border-t border-white/15 p-3">
        {sim.persistenceError && (
          <div role="alert" className="mb-2 rounded-md border border-danger-400/30 bg-danger-500/10 p-2 text-xs text-red-100">
            <p>{sim.persistenceError}</p>
            {sim.hasPendingStart && (
              <button onClick={sim.retryStart} disabled={sim.isStarting} className="mt-2 font-semibold text-accent-300 underline disabled:opacity-50">
                {sim.isStarting ? 'Retrying start...' : 'Retry creating this test'}
              </button>
            )}
            {sim.hasPendingFinalization && sim.testId && (
              <button onClick={sim.retryFinalize} disabled={sim.isFinalizing} className="mt-2 font-semibold text-accent-300 underline disabled:opacity-50">
                {sim.isFinalizing ? 'Retrying save...' : 'Retry saving this test'}
              </button>
            )}
          </div>
        )}
        {running ? (
          <button
            onClick={sim.stopTest}
            disabled={sim.isFinalizing || sim.hasPendingFinalization}
            className="group flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-red-300/40 bg-red-300/10 py-2 text-sm font-bold uppercase tracking-wider text-red-200 transition hover:bg-red-700 hover:text-white disabled:cursor-wait disabled:opacity-60 md:py-3"
          >
            <Pause className="h-4 w-4" />
            {sim.isFinalizing ? 'Saving Test...' : 'Stop Simulation'}
            <Octagon className="h-3.5 w-3.5 opacity-60 transition group-hover:opacity-100" />
          </button>
        ) : (
          <button
            onClick={sim.startTest}
            disabled={!canStart}
            className="group flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-300/10 py-2 text-sm font-bold uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-700 hover:text-white disabled:cursor-wait disabled:opacity-60 md:py-3"
          >
            <Play className="h-4 w-4" />
            {sim.isStarting ? (sim.hasPendingStart ? 'Retrying Start...' : 'Creating Test...') : sim.isRestoring ? 'Checking Test...' : sim.hasPendingStart ? 'Retry Start' : 'Start Simulation'}
          </button>
        )}
        <p className="mt-1 text-center text-[10px] text-white/55 md:mt-2">
          {running ? 'Stop and save the current test' : 'A test record is created automatically'}
        </p>
      </div>
    </aside>
  );
}
