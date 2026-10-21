import { Thermometer, Droplets, Gauge } from 'lucide-react';
import { Panel } from '../Panel';

export function Environment() {
  const readings = [
    { icon: Thermometer, label: 'Temperature', unit: '°C', color: 'text-warn-400' },
    { icon: Droplets, label: 'Humidity', unit: '%', color: 'text-accent-400' },
    { icon: Gauge, label: 'Air Pressure', unit: 'hPa', color: 'text-ok-400' },
  ];

  return (
    <Panel title="Environment" icon={<Gauge className="h-4 w-4" />} className="h-full">
      <div className="flex h-full flex-col justify-center gap-3">
        {readings.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.label} className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-md bg-base-700/60 ${r.color}`}><Icon className="h-4 w-4" /></span>
                  <span className="text-xs text-slate-400">{r.label}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg font-bold text-slate-500">N/A <span className="text-xs font-normal">{r.unit}</span></div>
                  <div className="text-[9px] uppercase tracking-wider text-warn-400">Sensor not connected</div>
                </div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-base-700/60" />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
