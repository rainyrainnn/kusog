import { useState } from 'react';
import { Compass, SlidersHorizontal, X, Check } from 'lucide-react';
import { Panel } from '../Panel';
import type { Simulation } from '@/hooks/useSimulation';

const DIRS = [
  { deg: 0, label: 'N', full: 'North' },
  { deg: 45, label: 'NE', full: 'Northeast' },
  { deg: 90, label: 'E', full: 'East' },
  { deg: 135, label: 'SE', full: 'Southeast' },
  { deg: 180, label: 'S', full: 'South' },
  { deg: 225, label: 'SW', full: 'Southwest' },
  { deg: 270, label: 'W', full: 'West' },
  { deg: 315, label: 'NW', full: 'Northwest' },
];

function degToCardinal(deg: number) {
  const d = ((deg % 360) + 360) % 360;
  const idx = Math.round(d / 45) % 8;
  return DIRS[idx];
}

export function WindDirection({ sim }: { sim: Simulation }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(sim.windDir);
  const cardinal = degToCardinal(sim.windDir);

  const apply = () => {
    sim.setWindDir(draft);
    sim.logWindDirection(draft);
    setOpen(false);
  };

  return (
    <Panel
      title="Wind Direction"
      icon={<Compass className="h-4 w-4" />}
      right={<span className="font-mono text-[10px] text-slate-500">SERVO · 0-359°</span>}
      className="h-full"
    >
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <CompassRose deg={sim.windDir} />
        <div className="text-center">
          <p className="font-mono text-2xl font-bold text-white">
            {cardinal.label} <span className="text-accent-400">{sim.windDir}°</span>
          </p>
          <p className="text-xs text-slate-400">{cardinal.full}</p>
        </div>

        <button
          onClick={() => {
            setDraft(sim.windDir);
            setOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg border border-base-600/70 bg-base-700/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-accent-500/50 hover:text-accent-400"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust Direction
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-base-600/70 bg-base-800 p-5 shadow-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-accent-400">
                Adjust Wind Direction
              </h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 flex justify-center">
              <CompassRose deg={draft} small />
            </div>

            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">Degrees</span>
              <span className="font-mono text-lg font-bold text-accent-400">
                {degToCardinal(draft).label} {draft}°
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={359}
              value={draft}
              onChange={(e) => setDraft(+e.target.value)}
              className="slider mb-4"
              style={{ ['--val' as any]: `${(draft / 359) * 100}%` }}
            />

            <div className="mb-4 grid grid-cols-8 gap-1">
              {DIRS.map((d) => (
                <button
                  key={d.label}
                  onClick={() => setDraft(d.deg)}
                  className={`rounded py-1 text-[10px] font-semibold transition ${
                    draft === d.deg
                      ? 'bg-accent-500/20 text-accent-400'
                      : 'text-slate-400 hover:bg-base-700/60'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <button
              onClick={apply}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-ok-500/15 py-2.5 text-sm font-bold uppercase tracking-widest text-ok-400 border border-ok-500/40 transition hover:bg-ok-500 hover:text-white"
            >
              <Check className="h-4 w-4" /> Apply Direction
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function CompassRose({ deg, small }: { deg: number; small?: boolean }) {
  const size = small ? 120 : 150;
  const c = size / 2;
  const r = c - 12;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={small ? 'h-28 w-28' : 'h-36 w-36'}>
      <circle cx={c} cy={c} r={r} fill="#0a0f1c" stroke="#1c2942" strokeWidth="2" />
      <circle cx={c} cy={c} r={r - 8} fill="none" stroke="#162038" strokeWidth="1" />

      {Array.from({ length: 36 }).map((_, i) => {
        const a = (i * 10 - 90) * (Math.PI / 180);
        const major = i % 9 === 0;
        const x1 = c + Math.cos(a) * (r - 8);
        const y1 = c + Math.sin(a) * (r - 8);
        const x2 = c + Math.cos(a) * (r - (major ? 16 : 12));
        const y2 = c + Math.sin(a) * (r - (major ? 16 : 12));
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={major ? '#38bdf8' : '#243352'} strokeWidth={major ? 2 : 1} />;
      })}

      {DIRS.map((d) => {
        const a = (d.deg - 90) * (Math.PI / 180);
        const x = c + Math.cos(a) * (r - 24);
        const y = c + Math.sin(a) * (r - 24);
        const active = degToCardinal(deg).label === d.label;
        return (
          <text
            key={d.label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            className={`font-mono text-[10px] font-bold ${active ? 'fill-accent-400' : 'fill-slate-500'}`}
          >
            {d.label}
          </text>
        );
      })}

      <g style={{ transform: `rotate(${deg}deg)`, transformOrigin: `${c}px ${c}px`, transition: 'transform 0.6s ease-out' }}>
        <polygon points={`${c},18 ${c - 5},${c} ${c + 5},${c}`} fill="#ef4444" />
        <polygon points={`${c},${size - 18} ${c - 4},${c} ${c + 4},${c}`} fill="#38bdf8" />
      </g>
      <circle cx={c} cy={c} r="5" fill="#0a0f1c" stroke="#38bdf8" strokeWidth="1.5" />
    </svg>
  );
}
