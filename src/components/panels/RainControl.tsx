import { CloudRain, Check } from 'lucide-react';
import { Panel } from '../Panel';
import type { RainLevel, Simulation } from '@/hooks/useSimulation';

const LEVELS: RainLevel[] = ['Light', 'Moderate', 'Heavy', 'Extreme'];
const COLORS: Record<RainLevel, string> = {
  Light: 'text-accent-400 border-accent-500/40 bg-accent-500/10',
  Moderate: 'text-warn-400 border-warn-500/40 bg-warn-500/10',
  Heavy: 'text-ok-400 border-ok-500/40 bg-ok-500/10',
  Extreme: 'text-danger-400 border-danger-500/40 bg-danger-500/10',
};

export function RainControl({ sim }: { sim: Simulation }) {
  return (
    <Panel title="Rain Intensity Control" icon={<CloudRain className="h-4 w-4" />} className="h-full">
      <div className="flex h-full flex-col justify-center gap-4">
        <div className="grid grid-cols-4 gap-1.5">
          {LEVELS.map((lvl) => {
            const active = sim.rainLevel === lvl;
            return (
              <button
                key={lvl}
                onClick={() => sim.setRainLevel(lvl)}
                className={`rounded-md border py-2 text-[11px] font-semibold uppercase tracking-wide transition ${
                  active
                    ? COLORS[lvl]
                    : 'border-base-600/70 bg-base-700/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-base-600/70 bg-base-900/60 px-3 py-2.5">
          <span className="text-xs text-slate-400">Intensity Output</span>
          <span className="font-mono text-2xl font-bold text-ok-400">{sim.rainValue}%</span>
        </div>

        <button
          onClick={sim.applyControls}
          className="flex items-center justify-center gap-2 rounded-lg bg-ok-500/15 py-2.5 text-sm font-bold uppercase tracking-widest text-ok-400 border border-ok-500/40 transition hover:bg-ok-500 hover:text-white"
        >
          <Check className="h-4 w-4" /> Apply
        </button>
      </div>
    </Panel>
  );
}
