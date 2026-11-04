import { Settings, Cpu, BrainCircuit, ShieldAlert, Database, Download } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import { fmtElapsed, type Simulation } from '@/hooks/useSimulation';

export function SettingsView({ sim }: { sim: Simulation }) {
  const exportCsv = () => {
    const rows = [['Time', 'Level', 'Message'], ...sim.logs.map((entry) => [entry.time, entry.level, entry.message])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kusog_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="System Settings" subtitle="Available system information and current-session data export" icon={<Settings className="h-5 w-5" />} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Hardware & Calibration" icon={<Cpu className="h-4 w-4" />} right={<span className="font-mono text-[10px] text-slate-500">UNAVAILABLE</span>}>
          <div className="space-y-3">
            <UnavailableSetting label="Sensor calibration" detail="No calibration command is connected to this interface. Sensor offsets are not changed here." />
            <UnavailableSetting label="Load-cell offset" detail="No configurable tare value is available from the current integration." />
            <UnavailableSetting label="COM port selection" detail="The active Raspberry Pi and sensor services do not use this browser-side port selector." />
          </div>
        </Panel>

        <Panel title="AI & Computer Vision" icon={<BrainCircuit className="h-4 w-4" />} right={<span className="font-mono text-[10px] text-slate-500">EDGE SERVICE</span>}>
          <div className="space-y-3">
            <UnavailableSetting label="Confidence threshold" detail="Detection confidence is returned by the existing edge model; this dashboard does not configure its threshold." />
            <UnavailableSetting label="Inference FPS cap" detail="The current edge-service integration exposes no FPS configuration control here." />
          </div>
        </Panel>

        <Panel title="Safety Controls" icon={<ShieldAlert className="h-4 w-4" />} right={<span className="font-mono text-[10px] text-slate-500">UNAVAILABLE</span>}>
          <UnavailableSetting label="Automatic force stop" detail="No configurable force threshold or automatic stop is connected to the simulation lifecycle. Stop an active simulation using its existing operator control." />
        </Panel>

        <Panel title="Storage & Data Export" icon={<Database className="h-4 w-4" />} right={<span className="font-mono text-[10px] text-slate-500">Supabase / PostgreSQL</span>}>
          <div className="space-y-4">
            <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-slate-300">
                  <Database className="h-4 w-4 text-slate-400" /> Database Status
                </span>
                <span className="rounded-full bg-base-700/60 px-2.5 py-1 text-xs font-semibold text-slate-400">
                  UNAVAILABLE
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">This page does not perform a database health check. Record queries and save errors are reported by their respective views.</p>
            </div>

            <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
              <p className="mb-2 text-sm text-slate-300">Current-session CSV export</p>
              <p className="mb-3 text-xs text-slate-500">Export the simulation log entries currently available in this session.</p>
              <button
                onClick={exportCsv}
                className="flex items-center gap-2 rounded-lg border border-ok-500/40 bg-ok-500/10 px-3 py-2 text-xs font-semibold text-ok-400 transition hover:bg-ok-500 hover:text-white"
              >
                <Download className="h-3.5 w-3.5" /> Export Logs as CSV
              </button>
            </div>

            <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3 text-xs">
              <div className="flex justify-between py-0.5"><span className="text-slate-400">Version</span><span className="font-mono text-slate-200">v2.4.0</span></div>
              <div className="flex justify-between py-0.5"><span className="text-slate-400">Build</span><span className="font-mono text-slate-200">2026.09.20</span></div>
              <div className="flex justify-between py-0.5"><span className="text-slate-400">Simulation duration</span><span className="font-mono text-slate-200">{fmtElapsed(sim.elapsed)}</span></div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function UnavailableSetting({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="shrink-0 rounded-full bg-base-700/60 px-2 py-1 text-[9px] font-bold tracking-wider text-slate-400">UNAVAILABLE</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}
