import { Compass } from 'lucide-react';
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
  const cardinal = degToCardinal(sim.windDir);

  return (
    <Panel
      title="Wind Direction"
      icon={<Compass className="h-4 w-4" />}
      right={<span className={`text-[10px] font-bold ${sim.windSensorConnected ? 'text-ok-400' : 'text-danger-400'}`}>{sim.windSensorConnected ? 'LIVE' : 'OFFLINE'}</span>}
      className="h-full"
    >
      <div className="flex h-full flex-col items-center justify-center gap-3">
        {sim.windSensorConnected ? <>
          <CompassRose deg={sim.windDir} />
          <div className="text-center">
            <p className="font-mono text-2xl font-bold text-white">
              {cardinal.label} <span className="text-accent-400">{sim.windDir.toFixed(1)}°</span>
            </p>
            <p className="text-xs text-slate-400">{cardinal.full}</p>
          </div>
        </> : <p className="py-12 text-center text-sm font-semibold text-danger-400">Wind Sensor Offline</p>}
      </div>
    </Panel>
  );
}

function CompassRose({ deg, small }: { deg: number; small?: boolean }) {
  const size = 150;
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
