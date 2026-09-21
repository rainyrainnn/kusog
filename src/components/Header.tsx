import { useState, useRef, useEffect } from 'react';
import { ChevronDown, User, Bell, SlidersHorizontal, Power } from 'lucide-react';
import type { Simulation } from '@/hooks/useSimulation';
import { fmtDate, fmtClock } from '@/hooks/useSimulation';
import { StatusDot } from './Panel';
import { ProfileModal } from '@/components/ProfileModal';
import { PreferencesModal } from '@/components/PreferencesModal';
import { KusogLogo } from '@/components/KusogLogo';
import type { OperatorProfile } from '@/App';

type Props = {
  sim: Simulation;
  profile: OperatorProfile;
  onSignOut: () => void;
};

export function Header({ sim, profile, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const displayName = profile.fullName.split(' ').slice(0, 2).join(' ');

  return (
    <>
      <header className="relative z-30 flex h-16 items-center justify-between border-b border-base-600/70 bg-base-850/90 px-5 backdrop-blur">
        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-base-950 shadow-glow-accent">
            <KusogLogo className="h-12 w-12" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-extrabold tracking-[0.2em] text-white">KUSOG</span>
              <span className="hidden rounded bg-accent-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-accent-400 sm:inline">
                v2.4
              </span>
            </div>
            <p className="text-[11px] font-medium tracking-wide text-slate-400">
              Smart Typhoon Simulation Chamber
            </p>
          </div>
        </div>

        {/* Center label */}
        <div className="hidden items-center gap-3 lg:flex">
          <div className="h-8 w-px bg-base-600/70" />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-[0.3em] text-white">DASHBOARD</p>
            <p className="text-[10px] tracking-wide text-slate-400">Real-time Monitoring and Control</p>
          </div>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 rounded-full border border-ok-500/30 bg-ok-500/10 px-3 py-1.5 md:flex">
            <StatusDot color="ok" />
            <span className="text-[11px] font-semibold tracking-wider text-ok-400">SYSTEM ONLINE</span>
          </div>

          <div className="hidden flex-col items-end leading-tight sm:flex">
            <span className="text-xs font-medium text-slate-300">{fmtDate(sim.now)}</span>
            <span className="font-mono text-sm font-semibold text-accent-400">{fmtClock(sim.now)}</span>
          </div>

          <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-base-600/70 bg-base-700/60 text-slate-400 transition hover:text-accent-400">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger-500" />
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-base-600/70 bg-base-700/60 py-1.5 pl-1.5 pr-2.5 transition hover:border-accent-500/50"
            >
              <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-accent-500 to-accent-600 text-white">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-semibold text-white">{displayName}</span>
                <span className="block text-[10px] text-slate-400">{profile.role}</span>
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 top-12 w-60 overflow-hidden rounded-lg border border-base-600/70 bg-base-800 shadow-panel animate-[fadeIn_0.15s_ease-out]">
                <div className="border-b border-base-600/60 px-3 py-2.5">
                  <p className="text-xs font-semibold text-white">{profile.fullName}</p>
                  <p className="text-[10px] text-slate-400">{profile.role}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-accent-400">{profile.studentNumber}</p>
                </div>
                <div className="py-1 text-sm text-slate-300">
                  <button
                    onClick={() => { setOpen(false); setProfileOpen(true); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-base-700/60 hover:text-accent-400"
                  >
                    <User className="h-3.5 w-3.5" /> Profile
                  </button>
                  <button
                    onClick={() => { setOpen(false); setPrefsOpen(true); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-base-700/60 hover:text-accent-400"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Preferences
                  </button>
                  <div className="my-1 border-t border-base-700/40" />
                  <button
                    onClick={() => { setOpen(false); onSignOut(); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-danger-400/80 hover:bg-danger-500/10 hover:text-danger-400"
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
