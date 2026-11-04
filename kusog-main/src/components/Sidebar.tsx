import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Camera,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  FileText,
  LayoutDashboard,
  LineChart,
  Menu,
  Octagon,
  Play,
  Settings,
  SlidersHorizontal,
  ScrollText,
  Square,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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

const NAV_GROUPS: { label: string; items: { id: RouteId; label: string; icon: LucideIcon }[] }[] = [
  {
    label: 'Monitoring',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'camera', label: 'Live Camera', icon: Camera },
      { id: 'environment', label: 'Environment', icon: CloudSun },
    ],
  },
  {
    label: 'Simulation',
    items: [{ id: 'controls', label: 'Controls', icon: SlidersHorizontal }],
  },
  {
    label: 'Analysis',
    items: [
      { id: 'graphs', label: 'Graphs', icon: LineChart },
      { id: 'ai', label: 'AI Assessment', icon: BrainCircuit },
    ],
  },
  {
    label: 'Records',
    items: [
      { id: 'log', label: 'Test Log', icon: ScrollText },
      { id: 'reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    label: 'System',
    items: [{ id: 'settings', label: 'Settings', icon: Settings }],
  },
];

export function Sidebar({ sim, route, onNavigate }: { sim: Simulation; route: RouteId; onNavigate: (r: RouteId) => void }) {
  const running = sim.isTestRunning;
  const canStart = !sim.isStarting && !sim.isRestoring && !sim.isFinalizing && !sim.hasPendingFinalization && !sim.isTestRunning;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  const navigate = (id: RouteId) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <aside
      className={`storm-sidebar z-20 flex min-h-0 w-full shrink-0 flex-col border-b border-sky-200/15 text-white transition-[width] duration-200 md:h-full md:border-b-0 md:border-r ${
        collapsed ? 'md:w-[76px]' : 'md:w-64'
      }`}
    >
      <div className={`flex min-h-[76px] items-center border-b border-sky-200/15 px-3 py-3 ${collapsed ? 'md:justify-center md:px-2' : 'gap-3 px-3.5'}`}>
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-sky-200/20 bg-base-950/60 shadow-panel">
          <KusogLogo className="h-10 w-10" />
        </span>
        <span className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>
          <span className="block font-mono text-sm font-bold tracking-[0.16em] text-slate-50">KUSOG</span>
          <span className="mt-0.5 block truncate text-[9px] font-medium uppercase tracking-[0.1em] text-slate-400">
            Smart chamber control
          </span>
        </span>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="primary-navigation"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sky-200/15 bg-slate-950/40 text-slate-300 transition-colors hover:border-accent-400/40 hover:bg-accent-400/10 hover:text-accent-300 md:hidden"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-accent-300 md:grid"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav
        id="primary-navigation"
        aria-label="Primary navigation"
        className={`${mobileOpen ? 'block' : 'hidden'} min-h-0 flex-1 overflow-y-auto bg-base-950/20 px-3 pb-3 md:block md:bg-transparent md:py-4 ${collapsed ? 'md:px-2' : ''}`}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-3 border-b border-sky-200/[0.08] pb-3 last:mb-0 last:border-b-0 last:pb-0">
            <p className={`mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 ${collapsed ? 'md:hidden' : ''}`}>
              {group.label}
            </p>
            <ul className="flex min-w-0 flex-col gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = route === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(item.id)}
                      aria-current={active ? 'page' : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      title={collapsed ? item.label : undefined}
                      className={`group relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[12px] transition-[background-color,color,box-shadow] duration-150 ${
                        collapsed ? 'md:justify-center md:px-0' : ''
                      } ${
                        active
                          ? 'bg-accent-400/[0.12] text-accent-100 shadow-[inset_2px_0_0_0_#00c8ff,0_4px_14px_rgba(0,200,255,0.1)]'
                          : 'text-slate-300 hover:bg-base-800/70 hover:text-slate-50'
                      }`}
                    >
                      <Icon
                        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                          active ? 'text-accent-300' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                        aria-hidden="true"
                      />
                      <span className={`min-w-0 flex-1 truncate font-medium ${collapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                      {active && <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-accent-300 shadow-[0_0_8px_rgba(0,200,255,0.5)] ${collapsed ? 'md:hidden' : ''}`} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={`border-t border-sky-200/10 p-3 ${collapsed ? 'md:px-2' : ''}`}>
        {sim.persistenceError && (
          <div role="alert" className="mb-2 rounded-lg border border-danger-400/30 bg-danger-500/10 p-2 text-xs text-red-100">
            {collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar to view test record error"
                title="Expand sidebar to view test record error"
                className="hidden h-8 w-full place-items-center text-danger-300 md:grid"
              >
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <div className={collapsed ? 'md:hidden' : ''}>
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
          </div>
        )}
        {running ? (
          <button
            onClick={sim.stopTest}
            disabled={sim.isFinalizing || sim.hasPendingFinalization}
            title={collapsed ? 'Stop simulation' : undefined}
            aria-label={sim.isFinalizing ? 'Saving test' : 'Stop simulation'}
            className={`group flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-300/30 bg-red-300/[0.08] py-2 text-sm font-bold uppercase tracking-wider text-red-200 transition-colors hover:bg-red-700/80 hover:text-white disabled:cursor-wait disabled:opacity-60 md:py-3 ${collapsed ? 'md:px-0' : ''}`}
          >
            <Square className="h-3.5 w-3.5 shrink-0 fill-current" />
            <span className={collapsed ? 'md:hidden' : ''}>{sim.isFinalizing ? 'Saving Test...' : 'Stop Simulation'}</span>
            <Octagon className={`h-3.5 w-3.5 opacity-60 transition group-hover:opacity-100 ${collapsed ? 'md:hidden' : ''}`} />
          </button>
        ) : (
          <button
            onClick={sim.startTest}
            disabled={!canStart}
            title={collapsed ? 'Start simulation' : undefined}
            aria-label={sim.isStarting ? 'Creating test' : sim.isRestoring ? 'Checking test' : sim.hasPendingStart ? 'Retry start' : 'Start simulation'}
            className={`group flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-accent-400/30 bg-accent-400/[0.08] py-2 text-sm font-bold uppercase tracking-wider text-accent-200 transition-colors hover:bg-accent-500/20 hover:text-accent-100 disabled:cursor-wait disabled:opacity-60 md:py-3 ${collapsed ? 'md:px-0' : ''}`}
          >
            <Play className="h-4 w-4 shrink-0" />
            <span className={collapsed ? 'md:hidden' : ''}>
              {sim.isStarting ? (sim.hasPendingStart ? 'Retrying Start...' : 'Creating Test...') : sim.isRestoring ? 'Checking Test...' : sim.hasPendingStart ? 'Retry Start' : 'Start Simulation'}
            </span>
          </button>
        )}
        {!collapsed && <p className="mt-2 text-center text-[10px] leading-snug text-slate-500">{running ? 'Stop and save the current test' : 'A test record is created automatically'}</p>}
        {collapsed && <Activity className="mx-auto mt-2 hidden h-3.5 w-3.5 text-slate-600 md:block" aria-hidden="true" />}
      </div>
    </aside>
  );
}
