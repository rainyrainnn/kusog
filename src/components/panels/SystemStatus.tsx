import { Activity, Cpu, Database, Thermometer, Droplets, Gauge } from 'lucide-react';
import { Panel, StatusDot } from '../Panel';
import { useSystemStatus, type ConnectionStatus } from '@/hooks/useSystemStatus';

function Status({ value, label }: { value: ConnectionStatus; label: string }) {
  const online = value === 'online';
  const pending = value === 'pending';
  return (
    <div className="flex items-center justify-between rounded-lg border border-base-600/70 bg-base-900/50 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <StatusDot color={online ? 'ok' : pending ? 'warn' : 'danger'} pulse={online} />
        <span className="text-xs text-slate-300">{label}</span>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${online ? 'text-ok-400' : pending ? 'text-warn-400' : 'text-danger-400'}`}>
        {online ? 'ONLINE' : pending ? 'CHECKING' : 'OFFLINE'}
      </span>
    </div>
  );
}

export function SystemStatus() {
  const system = useSystemStatus();
  const sensors = [
    { icon: Thermometer, label: 'Temperature' },
    { icon: Droplets, label: 'Humidity' },
    { icon: Gauge, label: 'Pressure' },
  ];

  return (
    <Panel
      title="KUSOG Smart Typhoon Simulation Chamber"
      icon={<Activity className="h-4 w-4" />}
      right={<span className="text-[10px] font-mono text-slate-500">SYSTEM STATUS</span>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Status value={system.raspberryPi} label="Raspberry Pi" />
          <Status value={system.webcam} label="Webcam" />
          <Status value={system.yolo} label="YOLO" />
          <Status value={system.supabase} label="Supabase" />
        </div>
        <div className="space-y-2">
          {sensors.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-between rounded-lg border border-base-600/70 bg-base-900/50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-500" />
                <span className="text-xs text-slate-300">{label}</span>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-warn-400">
                <StatusDot color="warn" pulse={false} /> NOT CONNECTED
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-600">
        <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> Edge AI hardware status is read from the Raspberry Pi API.</span>
        <span className="flex items-center gap-1.5"><Database className="h-3 w-3" /> Sensor values remain NULL until hardware is installed.</span>
      </div>
    </Panel>
  );
}
