import { Activity, CloudSun, Droplets, Gauge, Thermometer } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';

const SENSORS = [
  { icon: Thermometer, label: 'Temperature', unit: '°C' },
  { icon: Droplets, label: 'Humidity', unit: '%' },
  { icon: Gauge, label: 'Air Pressure', unit: 'hPa' },
];

export function EnvironmentView() {
  return (
    <div className="space-y-4">
      <PageHeader title="Environment Monitoring" subtitle="Environmental sensor is not connected; no readings are currently available." icon={<CloudSun className="h-5 w-5" />} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {SENSORS.map(({ icon: Icon, label, unit }) => (
          <Panel key={label} title={label} icon={<Icon className="h-4 w-4" />} className="h-full">
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-base-700/60 text-slate-500">
                <Icon className="h-6 w-6" />
              </span>
              <p className="font-mono text-3xl font-bold text-slate-500">N/A <span className="text-sm font-normal">{unit}</span></p>
              <p className="text-xs font-semibold uppercase tracking-wider text-warn-400">Sensor not connected</p>
            </div>
          </Panel>
        ))}
      </div>

      <Panel title="Sensor Health" icon={<Activity className="h-4 w-4" />}>
        <div className="rounded-lg border border-warn-400/20 bg-warn-400/5 px-4 py-5 text-center">
          <p className="text-sm font-semibold text-warn-300">Environmental monitoring unavailable</p>
          <p className="mt-1 text-xs text-slate-400">Connect and configure an environmental sensor to display live temperature, humidity, and pressure measurements.</p>
        </div>
      </Panel>
    </div>
  );
}
