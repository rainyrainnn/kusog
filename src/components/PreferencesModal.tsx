import { useState } from 'react';
import { SlidersHorizontal, Volume2, Gauge, Thermometer, Wind } from 'lucide-react';
import { Modal } from '@/components/Modal';

const REFRESH_RATES = [
  { label: '250ms', value: 250 },
  { label: '500ms', value: 500 },
  { label: '1s',    value: 1000 },
];

const TEMP_UNITS = [
  { label: '°C', value: 'C' as const },
  { label: '°F', value: 'F' as const },
];

const WIND_UNITS = [
  { label: 'km/h', value: 'kmh' as const },
  { label: 'm/s',  value: 'ms'  as const },
];

export function PreferencesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [refreshRate, setRefreshRate] = useState(500);
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const [windUnit, setWindUnit] = useState<'kmh' | 'ms'>('kmh');

  return (
    <Modal open={open} onClose={onClose} title="Preferences" icon={<SlidersHorizontal className="h-4 w-4" />} maxWidth="max-w-lg">
      <div className="space-y-5">
        <Section icon={Gauge} label="Graph Refresh Rate">
          <div className="grid grid-cols-3 gap-2">
            {REFRESH_RATES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRefreshRate(r.value)}
                className={`rounded-lg border py-2.5 text-sm font-semibold transition ${
                  refreshRate === r.value
                    ? 'border-accent-500/40 bg-accent-500/15 text-accent-400'
                    : 'border-base-600/70 bg-base-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={Volume2} label="Audio Alerts">
          <button
            onClick={() => setAudioAlerts((a) => !a)}
            className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold transition ${
              audioAlerts
                ? 'border-ok-500/40 bg-ok-500/10 text-ok-400'
                : 'border-base-600/70 bg-base-700/60 text-slate-400'
            }`}
          >
            <span>{audioAlerts ? 'Enabled' : 'Disabled'}</span>
            <span className={`relative h-5 w-9 rounded-full transition ${audioAlerts ? 'bg-ok-500' : 'bg-base-600'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${audioAlerts ? 'left-4' : 'left-0.5'}`} />
            </span>
          </button>
        </Section>

        <Section icon={Thermometer} label="Temperature Unit">
          <div className="grid grid-cols-2 gap-2">
            {TEMP_UNITS.map((u) => (
              <button
                key={u.value}
                onClick={() => setTempUnit(u.value)}
                className={`rounded-lg border py-2.5 text-sm font-semibold transition ${
                  tempUnit === u.value
                    ? 'border-accent-500/40 bg-accent-500/15 text-accent-400'
                    : 'border-base-600/70 bg-base-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={Wind} label="Wind Speed Unit">
          <div className="grid grid-cols-2 gap-2">
            {WIND_UNITS.map((u) => (
              <button
                key={u.value}
                onClick={() => setWindUnit(u.value)}
                className={`rounded-lg border py-2.5 text-sm font-semibold transition ${
                  windUnit === u.value
                    ? 'border-accent-500/40 bg-accent-500/15 text-accent-400'
                    : 'border-base-600/70 bg-base-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </Modal>
  );
}

function Section({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent-400" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      {children}
    </div>
  );
}
