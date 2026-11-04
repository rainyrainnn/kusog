import { useState, useRef, useEffect } from 'react';
import { ChevronDown, User, SlidersHorizontal, Power } from 'lucide-react';
import type { Simulation } from '@/hooks/useSimulation';
import { fmtDate, fmtClock } from '@/hooks/useSimulation';
import { ProfileModal } from '@/components/ProfileModal';
import { PreferencesModal } from '@/components/PreferencesModal';
import type { OperatorProfile } from '@/App';
import type { RouteId } from '@/components/Sidebar';
import { useSystemStatus } from '@/hooks/useSystemStatus';

type Props = {
  sim: Simulation;
  profile: OperatorProfile;
  onSignOut: () => void;
  route: RouteId;
};

const ROUTE_CONTEXT: Record<RouteId, { title: string; section: string }> = {
  dashboard: { title: 'Dashboard', section: 'Monitoring' },
  camera: { title: 'Live Camera', section: 'Monitoring' },
  environment: { title: 'Environment', section: 'Monitoring' },
  controls: { title: 'Controls', section: 'Simulation' },
  graphs: { title: 'Graphs', section: 'Analysis' },
  ai: { title: 'AI Assessment', section: 'Analysis' },
  log: { title: 'Test Log', section: 'Records' },
  reports: { title: 'Reports', section: 'Records' },
  settings: { title: 'Settings', section: 'System' },
};

export function Header({ sim, profile, onSignOut, route }: Props) {
  const system = useSystemStatus();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const displayName = profile.fullName.split(' ').slice(0, 2).join(' ');
  const context = ROUTE_CONTEXT[route];
  const systemLabel = system.raspberryPi === 'online'
    ? 'Online'
    : system.raspberryPi === 'pending'
      ? 'Checking'
      : system.raspberryPi === 'error'
        ? 'System error'
        : 'Offline';
  const systemColor = system.raspberryPi === 'online'
    ? 'bg-ok-400'
    : system.raspberryPi === 'pending'
      ? 'bg-warn-400'
      : 'bg-danger-400';

  return (
    <>
      <header className="storm-header relative z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-sky-200/15 px-3 py-2.5 sm:px-4 md:px-6">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="mb-1 hidden items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:flex">
            <span>Control Center</span>
            <span className="text-slate-600">/</span>
            <span className="text-accent-300/90">{context.section}</span>
          </p>
          <h1 className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">{context.title}</h1>
          <p className="mt-1 hidden text-[10px] text-slate-400 sm:block">KUSOG Smart Typhoon Simulation Chamber</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 md:gap-4">
          <div
            role="status"
            className="flex h-9 items-center gap-2 rounded-lg border border-sky-200/10 bg-slate-950/35 px-2.5 sm:px-3"
            aria-label={`Edge system ${systemLabel.toLowerCase()}`}
            title={`Edge system ${systemLabel.toLowerCase()}`}
          >
            <span className={`relative h-2 w-2 shrink-0 rounded-full ${systemColor}`}>
              {system.raspberryPi === 'online' && <span className="absolute inset-0 animate-ping rounded-full bg-ok-400 opacity-30" />}
            </span>
            <span className="hidden text-[11px] font-medium text-slate-200 sm:inline">
              Edge <span className="text-slate-400">{systemLabel}</span>
            </span>
            <span className="sr-only sm:hidden">Edge {systemLabel}</span>
            <span className="hidden border-l border-sky-200/15 pl-2.5 font-mono text-[10px] text-slate-400 xl:inline">
              {fmtDate(sim.now)} · {fmtClock(sim.now)}
            </span>
          </div>

          <div className="relative" ref={ref}>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label={`Account menu for ${displayName}`}
              aria-expanded={open}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-sky-200/15 bg-base-950/45 py-1.5 pl-1.5 pr-2 text-slate-50 transition-colors hover:border-accent-400/40 hover:bg-base-950/75 focus-visible:outline-accent-400 sm:gap-2.5 sm:pr-3"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent-400/20 bg-accent-400/10 text-accent-200">
                <User className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="hidden min-w-0 text-left leading-tight sm:block">
                <span className="block max-w-32 truncate text-xs font-semibold text-slate-100">{displayName}</span>
                <span className="mt-0.5 block text-[10px] text-slate-400">{profile.role}</span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {open && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-sky-200/15 bg-base-850 shadow-panel animate-[fadeIn_0.15s_ease-out]">
                <div className="border-b border-sky-200/10 bg-base-950/35 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-slate-100">{profile.fullName}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{profile.email}</p>
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-sky-200/[0.08] pt-2">
                    <span className="text-[10px] text-slate-500">{profile.role}</span>
                    <span className="rounded-md border border-accent-400/15 bg-accent-400/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-accent-300">{profile.studentNumber}</span>
                  </div>
                </div>
                <div className="p-1.5 text-sm text-slate-200">
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setProfileOpen(true); }}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-slate-300 transition-colors hover:bg-base-750 hover:text-accent-300"
                  >
                    <User className="h-3.5 w-3.5" aria-hidden="true" /> Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setPrefsOpen(true); }}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-slate-300 transition-colors hover:bg-base-750 hover:text-accent-300"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> Preferences
                  </button>
                  <div className="my-1.5 border-t border-sky-200/[0.08]" />
                  <button
                    type="button"
                    onClick={() => { setOpen(false); onSignOut(); }}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-danger-400 transition-colors hover:bg-danger-500/10"
                  >
                    <Power className="h-3.5 w-3.5" aria-hidden="true" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} profile={profile} />
      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </>
  );
}
