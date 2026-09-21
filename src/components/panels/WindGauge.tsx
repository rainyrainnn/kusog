import { Wind } from 'lucide-react';
import { Panel } from '../Panel';
import { windLabel, type Simulation } from '@/hooks/useSimulation';

export function WindGauge({ sim }: { sim: Simulation }) {
  const max = 120;
  const pct = Math.min(1, sim.windSpeed / max);
  const label = windLabel(sim.windSpeed);
  const angle = -120 + pct * 240;

  const r = 70;
  const cx = 90;
  const cy = 90;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - pct);

  return (
    <Panel title="Wind Speed" icon={<Wind className="h-4 w-4" />} className="h-full">
      <div className="flex h-full flex-col items-center justify-center">
        <div className="relative">
          <svg viewBox="0 0 180 120" className="w-44">
            <path
              d={`M20,90 A${r},${r} 0 0 1 160,90`}
              fill="none"
              stroke="#1c2942"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d={`M20,90 A${r},${r} 0 0 1 160,90`}
              fill="none"
              stroke="url(#windGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
            />
            <defs>
              <linearGradient id="windGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const a = (-120 + t * 240) * (Math.PI / 180);
              const x1 = cx + Math.cos(a) * (r - 16);
              const y1 = cy + Math.sin(a) * (r - 16);
              const x2 = cx + Math.cos(a) * (r - 22);
              const y2 = cy + Math.sin(a) * (r - 22);
              return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#243352" strokeWidth="2" />;
            })}
            <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '90px 90px', transition: 'transform 0.8s ease-out' }}>
              <line x1="90" y1="90" x2="90" y2="30" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="90" cy="30" r="3" fill="#38bdf8" />
            </g>
            <circle cx="90" cy="90" r="6" fill="#0a0f1c" stroke="#38bdf8" strokeWidth="2" />
          </svg>
          <div className="absolute inset-x-0 bottom-1 text-center">
            <p className="font-mono text-3xl font-bold text-white">
              {sim.windSpeed.toFixed(1)}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">km/h</p>
          </div>
        </div>
        <div className={`mt-2 rounded-full border px-3 py-1 ${sim.isTestRunning ? 'border-accent-500/30 bg-accent-500/10' : 'border-base-600/70 bg-base-700/40'}`}>
          <span className={`text-xs font-semibold tracking-wide ${sim.isTestRunning ? 'text-accent-400' : 'text-slate-500'}`}>
            {sim.isTestRunning ? label : 'Standby'}
          </span>
        </div>
      </div>
    </Panel>
  );
}
