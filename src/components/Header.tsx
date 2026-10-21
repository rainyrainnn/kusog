import { useState, useRef, useEffect } from 'react';
import { ChevronDown, User, SlidersHorizontal, Power } from 'lucide-react';
import type { Simulation } from '@/hooks/useSimulation';
import { fmtDate, fmtClock } from '@/hooks/useSimulation';
import { ProfileModal } from '@/components/ProfileModal';
import { PreferencesModal } from '@/components/PreferencesModal';
import { KusogLogo } from '@/components/KusogLogo';
import type { OperatorProfile } from '@/App';
import type { RouteId } from '@/components/Sidebar';
import { useSystemStatus } from '@/hooks/useSystemStatus';

type Props = {
  sim: Simulation;
  profile: OperatorProfile;
  onSignOut: () => void;
  route: RouteId;
};

const ROUTE_TITLES: Record<RouteId, string> = {
  dashboard: 'Dashboard',
  camera: 'Live Camera',
  environment: 'Environment',
  controls: 'Controls',
  graphs: 'Graphs',
  ai: 'AI Assessment',
  log: 'Test Log',
  reports: 'Reports',
  settings: 'Settings',
};

export function Header({ sim, profile, onSignOut, route }: Props) {
  const system = useSystemStatus();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const displayName = profile.fullName.split(' ').slice(0, 2).join(' ');

  return (
    <>
      <header className="storm-header relative z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-sky-200/20 px-3 py-2.5 md:px-5">
        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-sky-300/20 bg-slate-950/50">
            <KusogLogo className="h-14 w-14" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-extrabold tracking-[0.12em] text-white">KUSOG</span>
              <span className="hidden text-sm font-semibold text-slate-200 sm:inline">Smart Typhoon Simulation Chamber</span>
            </div>
            <p className="hidden text-[11px] font-medium tracking-wide text-slate-300 sm:block">
              Safer Communities. Stronger Tomorrow.
            </p>
          </div>
        </div>

        <div className="hidden min-w-0 items-center gap-3 lg:flex">
          <div className="h-8 w-px bg-base-600/70" />
          <div className="leading-tight">
            <p className="truncate text-sm font-bold text-slate-100">{ROUTE_TITLES[route]}</p>
            <p className="text-[10px] tracking-wide text-slate-400">CONTROL CENTER</p>
          </div>
        </div>

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <div className="hidden items-center gap-2 lg:flex">
            <span className={`h-2 w-2 rounded-full ${system.raspberryPi === 'online' ? 'bg-ok-400' : system.raspberryPi === 'pending' ? 'bg-warn-400' : 'bg-danger-400'}`} />
            <span className="text-[11px] font-semibold text-slate-200">
              {system.raspberryPi === 'online' ? 'Edge System Online' : system.raspberryPi === 'pending' ? 'Checking Edge System' : 'Edge System Offline'}
            </span>
            <span className="hidden font-mono text-[10px] text-slate-400 xl:inline">{fmtDate(sim.now)} · {fmtClock(sim.now)}</span>
          </div>

          {/* Profile dropdown */}
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label={`Account menu for ${displayName}`}
              aria-expanded={open}
              className="flex min-h-10 items-center gap-2 rounded-md border border-sky-200/20 bg-slate-950/40 py-1.5 pl-1.5 pr-2.5 text-white transition hover:border-accent-400"
            >
              <span className="grid h-7 w-7 place-items-center rounded-md bg-sky-500/20 text-sky-200">
                <User className="h-4 w-4" />
              </span>
                <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-semibold text-slate-900">{displayName}</span>
                <span className="block text-[10px] text-slate-600">{profile.role}</span>
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-300 transition ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 top-12 z-40 w-60 overflow-hidden rounded-md border border-sky-200/20 bg-base-850 shadow-panel animate-[fadeIn_0.15s_ease-out]">
                <div className="border-b border-sky-200/15 px-3 py-2.5">
                  <p className="text-xs font-semibold text-slate-100">{profile.fullName}</p>
                  <p className="text-[10px] text-slate-400">{profile.role}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-accent-300">{profile.studentNumber}</p>
                </div>
                <div className="py-1 text-sm text-slate-200">
                  <button
                    onClick={() => { setOpen(false); setProfileOpen(true); }}
                    className="flex min-h-10 w-full items-center gap-2.5 px-3 py-2 hover:bg-base-750 hover:text-accent-300"
                  >
                    <User className="h-3.5 w-3.5" /> Profile
                  </button>
                  <button
                    onClick={() => { setOpen(false); setPrefsOpen(true); }}
                    className="flex min-h-10 w-full items-center gap-2.5 px-3 py-2 hover:bg-base-750 hover:text-accent-300"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Preferences
                  </button>
                  <div className="my-1 border-t border-base-700/40" />
                  <button
                    onClick={() => { setOpen(false); onSignOut(); }}
                    className="flex min-h-10 w-full items-center gap-2.5 px-3 py-2 text-danger-400 hover:bg-danger-500/10"
                  >
                    <Power className="h-3.5 w-3.5" /> Sign Out
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
