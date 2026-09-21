import { useState } from 'react';
import { Weight, LineChart, Clock } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import type { Simulation, TelemetryPoint } from '@/hooks/useSimulation';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

const tooltipStyle = {
  backgroundColor: '#0a0f1c',
  border: '1px solid #1c2942',
  borderRadius: '8px',
  fontSize: '11px',
  color: '#e2e8f0',
};

const RANGES = [
  { label: '30s', value: 30 },
  { label: '1m',  value: 60 },
  { label: '5m',  value: 300 },
  { label: 'All', value: 9999 },
];

function BigChart({ data, color, yLabel, yDomain, badge }: {
  data: TelemetryPoint[];
  color: string;
  yLabel: string;
  yDomain: [number, number];
  badge: string;
}) {
  return (
    <Panel title={badge} icon={<Weight className="h-4 w-4" />} className="h-full" bodyClassName="p-3">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 6, left: 0 }}>
            <defs>
              <linearGradient id={`big-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1c2942" strokeDasharray="3 3" />
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#475569' }} stroke="#1c2942" tickLine={false} interval="preserveStartEnd" minTickGap={40} label={{ value: 'Time (s)', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#475569' }} />
            <YAxis tick={{ fontSize: 10, fill: '#475569' }} stroke="#1c2942" tickLine={false} domain={yDomain} width={44} label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 10, fill: '#475569' }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [Number(v).toFixed(2), yLabel]} labelFormatter={(t) => `t = ${t}s`} />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#big-${color})`} isAnimationActive={false} dot={false} />
            <ReferenceLine y={yDomain[0]} stroke="#1c2942" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function GraphsView({ sim }: { sim: Simulation }) {
  const [range, setRange] = useState(9999);
  const slice = (data: TelemetryPoint[]) => (range === 9999 ? data : data.slice(-range));

  return (
    <div className="space-y-4">
      <PageHeader title="Sensor Telemetry Graphs" subtitle="High-resolution real-time charts · Load Cell" icon={<LineChart className="h-5 w-5" />} />

      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" /> Time Range:
        </span>
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
              range === r.value
                ? 'border-accent-500/40 bg-accent-500/15 text-accent-400'
                : 'border-base-600/70 bg-base-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {r.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 rounded-lg border border-base-600/70 bg-base-800/60 px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Current Force</span>
            <span className="font-mono text-sm font-bold text-ok-400">{sim.currentForce.toFixed(1)} N</span>
          </div>
        </div>
      </div>

      <BigChart data={slice(sim.forceHist)} color="#4ade80" yLabel="N" yDomain={[0, 60]} badge="Base Uplift Force (Load Cell)" />

      <div className="rounded-xl border border-base-600/70 bg-base-800/60 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-ok-500/10 text-ok-400">
            <Weight className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Current Force</p>
            <p className="font-mono text-2xl font-bold text-ok-400">
              {sim.currentForce.toFixed(1)}<span className="ml-1 text-sm text-slate-500">N</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
