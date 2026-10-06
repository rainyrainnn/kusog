import { SlidersHorizontal, Fan, Wind } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import { RainControl } from '@/components/panels/RainControl';
import { WindDirection } from '@/components/panels/WindDirection';
import { WindGauge } from '@/components/panels/WindGauge';
import type { Simulation } from '@/hooks/useSimulation';
import { windLabel } from '@/hooks/useSimulation';
import type { RainSensorData } from '@/lib/rainSensor';

export function ControlsView({ sim, rainSensor, sensorError, sensorLoading }: { sim: Simulation; rainSensor: RainSensorData; sensorError: string | null; sensorLoading: boolean }) {
  const fanSliderStyle = { '--val': `${sim.fanSpeed}%` } as CSSProperties & { '--val': string };
  return (
    <div className="space-y-4">
      <PageHeader title="Sensors & Actuators" subtitle="Rain sensor input, fan test control & read-only wind sensor" icon={<SlidersHorizontal className="h-5 w-5" />} />

      <div className="grid grid-cols-12 gap-4">
        {/* Fan speed */}
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <Panel title="Fan Speed Control" icon={<Fan className="h-4 w-4" />} right={<span className="font-mono text-[10px] text-slate-500">TEST CONTROL ONLY</span>} className="h-full">
            <div className="flex h-full flex-col justify-center gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-4xl font-bold text-accent-400">{sim.fanSpeed}%</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Test command</p>
                </div>
                <div
                  className={`grid h-14 w-14 place-items-center rounded-full border border-accent-500/30 bg-accent-500/10 ${sim.isTestRunning && sim.fanSpeed > 0 ? 'animate-fan-spin' : ''}`}
                  style={{ animationDuration: `${Math.max(0.3, 2 - sim.fanSpeed / 60)}s` }}
                >
                  <Fan className="h-7 w-7 text-accent-400" />
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                value={sim.fanSpeed}
                onChange={(e) => sim.setFanSpeed(+e.target.value)}
                className="slider"
                style={fanSliderStyle}
              />

              <div className="grid grid-cols-4 gap-2">
                {[-10, -1, 1, 10].map((s) => (
                  <button
                    key={s}
                    onClick={() => sim.adjustFan(s)}
                    className="flex items-center justify-center gap-0.5 rounded-md border border-base-600/70 bg-base-700/60 py-2 text-xs font-semibold text-slate-300 transition hover:border-accent-500/50 hover:bg-accent-500/10 hover:text-accent-400"
                  >
                    {s > 0 ? '+' : ''}{s}%
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3 text-xs">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-warn-400">Simulation estimates only</p>
                <div className="flex justify-between py-0.5"><span className="text-slate-400">PWM duty estimate</span><span className="font-mono text-slate-200">{sim.fanSpeed * 10}/1000</span></div>
                <div className="flex justify-between py-0.5"><span className="text-slate-400">Estimated RPM</span><span className="font-mono text-slate-200">{Math.round((sim.fanSpeed / 100) * 2800)}</span></div>
                <div className="flex justify-between py-0.5"><span className="text-slate-400">Estimated power</span><span className="font-mono text-slate-200">{((sim.fanSpeed / 100) * 45).toFixed(1)} W</span></div>
              </div>
              <p className="text-[10px] text-slate-500">Fan control and estimates are simulation/test only; no physical fan API is connected.</p>
            </div>
          </Panel>
        </div>

        {/* Rain sensor input */}
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <RainControl sensor={rainSensor} sensorError={sensorError} loading={sensorLoading} />
        </div>

        {/* Wind direction */}
        <div className="col-span-12 xl:col-span-4">
          <WindDirection sim={sim} />
        </div>
      </div>

      {/* Live readout */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <WindGauge sim={sim} />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-8">
          <Panel title="Control Summary" icon={<Wind className="h-4 w-4" />} className="h-full">
            <div className="grid h-full grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard label="Fan Speed" value={`${sim.fanSpeed}%`} />
              <SummaryCard label="Rain Status" value={sensorLoading ? 'LOADING' : sensorError ? 'ERROR' : !rainSensor.connected ? rainSensor.offline ? 'OFFLINE' : 'WAITING' : rainSensor.rainState === 'rain' ? 'RAIN' : rainSensor.rainState === 'normal' ? 'NO RAIN' : 'UNKNOWN'} />
              <SummaryCard label="Rain Level" value={rainSensor.connected ? rainSensor.rainLevel : '—'} />
              <SummaryCard label="Wind Speed" value={sim.windSensorConnected ? `${sim.windSpeed.toFixed(1)} m/s` : 'Wind Sensor Offline'} />
              <SummaryCard label="Wind Class" value={sim.windSensorConnected ? windLabel(sim.windSpeed * 3.6) : '—'} />
              <SummaryCard label="Wind Direction" value={sim.windSensorConnected ? `${sim.windDir.toFixed(1)}°` : 'Wind Sensor Offline'} />
              <SummaryCard label="Status" value={sim.isTestRunning ? 'RUNNING' : 'STANDBY'} accent={sim.isTestRunning} />
            </div>
          </Panel>
        </div>
      </div>
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
