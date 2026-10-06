import { Fan, Plus, Minus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Panel } from '../Panel';
import type { Simulation } from '@/hooks/useSimulation';

export function FanControl({ sim }: { sim: Simulation }) {
  const sliderStyle = { '--val': `${sim.fanSpeed}%` } as CSSProperties & { '--val': string };
  const steps = [-10, -1, 1, 10];

  return (
    <Panel
      title="Fan Speed Control"
      icon={<Fan className="h-4 w-4" />}
      right={<span className="font-mono text-[10px] text-slate-500">TEST CONTROL ONLY</span>}
      className="h-full"
    >
      <div className="flex h-full flex-col justify-center gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-3xl font-bold text-accent-400">{sim.fanSpeed}%</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Test command</p>
          </div>
          <div
            className={`grid h-12 w-12 place-items-center rounded-full border border-accent-500/30 bg-accent-500/10 ${sim.isTestRunning && sim.fanSpeed > 0 ? 'animate-fan-spin' : ''}`}
            style={{ animationDuration: `${Math.max(0.3, 2 - sim.fanSpeed / 60)}s` }}
          >
            <Fan className="h-6 w-6 text-accent-400" />
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={sim.fanSpeed}
          onChange={(e) => sim.setFanSpeed(+e.target.value)}
          className="slider"
          style={sliderStyle}
        />

        <div className="grid grid-cols-4 gap-1.5">
          {steps.map((s) => (
            <button
              key={s}
              onClick={() => sim.adjustFan(s)}
              className="flex items-center justify-center gap-0.5 rounded-md border border-base-600/70 bg-base-700/60 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-accent-500/50 hover:bg-accent-500/10 hover:text-accent-400"
            >
              {s > 0 ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {Math.abs(s)}%
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500">Simulation/test control; not connected to physical fan hardware.</p>
      </div>
    </Panel>
  );
}
