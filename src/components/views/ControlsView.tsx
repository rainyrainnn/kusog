import { SlidersHorizontal, Wind } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import { RainControl } from '@/components/panels/RainControl';
import { WindDirection } from '@/components/panels/WindDirection';
import { WindGauge } from '@/components/panels/WindGauge';
import type { Simulation } from '@/hooks/useSimulation';
import { windLabel } from '@/hooks/useSimulation';
import type { RainSensorData } from '@/lib/rainSensor';

export function ControlsView({ sim, rainSensor, sensorError, sensorLoading }: { sim: Simulation; rainSensor: RainSensorData; sensorError: string | null; sensorLoading: boolean }) {
  return (
    <div className="space-y-4">
      <PageHeader title="Sensor Monitoring" subtitle="Live readings from connected rain and wind sensors; wind is monitored, not controlled." icon={<SlidersHorizontal className="h-5 w-5" />} />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <RainControl sensor={rainSensor} sensorError={sensorError} loading={sensorLoading} />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <WindDirection sim={sim} />
        </div>
        <div className="col-span-12 xl:col-span-4">
          <WindGauge sim={sim} />
        </div>
      </div>

      <Panel title="Sensor Summary" icon={<Wind className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard
            label="Rain Status"
            value={sensorLoading ? 'LOADING' : sensorError ? 'ERROR' : !rainSensor.connected ? rainSensor.offline ? 'OFFLINE' : 'WAITING' : rainSensor.rainState === 'rain' ? 'RAIN' : rainSensor.rainState === 'normal' ? 'NO RAIN' : 'UNKNOWN'}
          />
          <SummaryCard label="Rain Level" value={rainSensor.connected ? rainSensor.rainLevel : 'Unavailable'} />
          <SummaryCard label="Wind Speed" value={sim.windSensorConnected ? `${sim.windSpeed.toFixed(1)} m/s` : 'Unavailable'} />
          <SummaryCard label="Wind Class" value={sim.windSensorConnected ? windLabel(sim.windSpeed * 3.6) : 'Unavailable'} />
          <SummaryCard label="Wind Direction" value={sim.windSensorConnected ? `${sim.windDir.toFixed(1)}°` : 'Unavailable'} />
          <SummaryCard label="Simulation Status" value={sim.testStatus} accent={sim.isTestRunning} />
        </div>
      </Panel>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold ${accent ? 'text-ok-400' : 'text-slate-200'}`}>{value}</p>
    </div>
  );
}
