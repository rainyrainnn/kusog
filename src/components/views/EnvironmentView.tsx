import { Thermometer, Droplets, Gauge, CloudSun, TrendingUp, Activity } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import type { Simulation } from '@/hooks/useSimulation';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const tooltipStyle = {
  backgroundColor: '#0a0f1c',
  border: '1px solid #1c2942',
  borderRadius: '8px',
  fontSize: '11px',
  color: '#e2e8f0',
};

// Generate baseline historical data
function genBaseline(base: number, variance: number, points = 40) {
  return Array.from({ length: points }, (_, i) => ({
    t: i,
    value: +(base + (Math.random() - 0.5) * variance).toFixed(1),
  }));
}

export function EnvironmentView({ sim }: { sim: Simulation }) {
  const running = sim.isTestRunning;
  const tempData = genBaseline(running ? sim.temperature : 26.5, 0.5);
  const humData = genBaseline(running ? sim.humidity : 55, 2);
  const presData = genBaseline(running ? sim.pressure : 1013, 1.5);

  const cards = [
    {
      icon: Thermometer,
      label: 'Temperature',
      value: running ? sim.temperature.toFixed(1) : '26.5',
      unit: '°C',
      color: 'text-warn-400',
      bg: 'bg-warn-500/10',
      border: 'border-warn-500/30',
      data: tempData,
      stroke: '#fbbf24',
      domain: [20, 35] as [number, number],
      baseline: 26.5,
    },
    {
      icon: Droplets,
      label: 'Humidity',
      value: running ? sim.humidity.toFixed(1) : '55.0',
      unit: '%',
      color: 'text-accent-400',
      bg: 'bg-accent-500/10',
      border: 'border-accent-500/30',
      data: humData,
      stroke: '#38bdf8',
      domain: [0, 100] as [number, number],
      baseline: 55,
    },
    {
      icon: Gauge,
      label: 'Air Pressure',
      value: running ? String(sim.pressure) : '1013',
      unit: 'hPa',
      color: 'text-ok-400',
      bg: 'bg-ok-500/10',
      border: 'border-ok-500/30',
      data: presData,
      stroke: '#4ade80',
      domain: [980, 1030] as [number, number],
      baseline: 1013,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Environment Monitoring" subtitle="Full ambient sensor metrics · BME280" icon={<CloudSun className="h-5 w-5" />} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Panel key={c.label} title={c.label} icon={<Icon className="h-4 w-4" />} className="h-full">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`grid h-12 w-12 place-items-center rounded-lg ${c.bg} ${c.color}`}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <p className={`font-mono text-3xl font-bold ${c.color}`}>
                      {c.value}<span className="ml-1 text-sm text-slate-500">{c.unit}</span>
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">
                      {running ? 'Live reading' : 'Baseline'}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <p className="text-slate-500">Baseline</p>
                  <p className="font-mono text-slate-300">{c.baseline}{c.unit}</p>
                </div>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={c.data} margin={{ top: 6, right: 6, bottom: 2, left: -20 }}>
                    <defs>
                      <linearGradient id={`env-${c.label}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.stroke} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={c.stroke} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1c2942" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#475569' }} stroke="#1c2942" tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#475569' }} stroke="#1c2942" tickLine={false} domain={c.domain} width={40} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [Number(v).toFixed(1), c.unit]} labelFormatter={(t) => `t = ${t}s`} />
                    <Area type="monotone" dataKey="value" stroke={c.stroke} strokeWidth={2} fill={`url(#env-${c.label})`} isAnimationActive={false} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel title="Sensor Health" icon={<Activity className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'BME280 Temp', status: 'OK' },
            { label: 'BME280 Humidity', status: 'OK' },
            { label: 'BME280 Pressure', status: 'OK' },
            { label: 'I2C Bus', status: 'OK' },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between rounded-lg border border-base-600/70 bg-base-900/50 px-3 py-2.5">
              <span className="text-xs text-slate-400">{s.label}</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ok-400">
                <span className="h-1.5 w-1.5 rounded-full bg-ok-500" /> {s.status}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
