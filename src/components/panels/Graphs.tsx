import { Weight } from 'lucide-react';
import { Panel } from '../Panel';
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

function LiveBadge({ label, value, color }: { label: string; value: string; color: 'accent' | 'ok' | 'warn' | 'danger' }) {
  const colorMap: Record<string, string> = {
    accent: 'text-accent-400 border-accent-500/30 bg-accent-500/10',
    ok:     'text-ok-400 border-ok-500/30 bg-ok-500/10',
    warn:   'text-warn-400 border-warn-500/30 bg-warn-500/10',
    danger: 'text-danger-400 border-danger-500/30 bg-danger-500/10',
  };
  return (
    <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${colorMap[color]}`}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}:</span>
      <span className="font-mono text-xs font-bold">{value}</span>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: '#0a0f1c',
  border: '1px solid #1c2942',
  borderRadius: '8px',
  fontSize: '11px',
  color: '#e2e8f0',
};

function ChartShell({ data, color, yLabel, yDomain }: {
  data: TelemetryPoint[];
  color: string;
  yLabel: string;
  yDomain: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 2, left: -18 }}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1c2942" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#475569' }} stroke="#1c2942" tickLine={false} interval="preserveStartEnd" minTickGap={30} />
        <YAxis tick={{ fontSize: 9, fill: '#475569' }} stroke="#1c2942" tickLine={false} domain={yDomain} width={36} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => `t = ${t}s`} formatter={(v: any) => [Number(v).toFixed(2), yLabel]} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.8} fill={`url(#grad-${color})`} isAnimationActive={false} dot={false} />
        <ReferenceLine y={0} stroke="#1c2942" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ForceGraph({ sim }: { sim: Simulation }) {
  return (
    <Panel
      title="Base Uplift Force (Load Cell)"
      icon={<Weight className="h-4 w-4" />}
      right={sim.loadCellConnected
        ? <LiveBadge label="Current" value={`${sim.currentForce.toFixed(1)} N`} color="ok" />
        : <span className="text-[10px] font-semibold text-danger-400">Base Uplift Sensor Offline</span>}
      className="h-full"
      bodyClassName="p-2"
    >
      <div className="h-32">
        <ChartShell data={sim.forceHist} color="#4ade80" yLabel="N" yDomain={[0, 60]} />
      </div>
    </Panel>
  );
}
