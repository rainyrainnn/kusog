import { useState } from 'react';
import { Settings, Cpu, BrainCircuit, ShieldAlert, Database, Download, RotateCcw, CheckCircle2, Gauge, Camera } from 'lucide-react';
import { Panel, StatusDot } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import { fmtElapsed, type Simulation } from '@/hooks/useSimulation';

export function SettingsView({ sim }: { sim: Simulation }) {
  const [mpuZeroed, setMpuZeroed] = useState(false);
  const [loadCellOffset, setLoadCellOffset] = useState(0);
  const [comPort, setComPort] = useState('COM3');
  const [yoloThreshold, setYoloThreshold] = useState(50);
  const [fpsCap, setFpsCap] = useState(30);
  const [maxForce, setMaxForce] = useState(45);

  const zeroSensors = () => {
    setMpuZeroed(false);
    setTimeout(() => setMpuZeroed(true), 800);
    sim.addLog('Sensor zeroing calibration complete', 'ok');
  };

  const exportCsv = () => {
    const rows = [['Time', 'Level', 'Message'], ...sim.logs.map((l) => [l.time, l.level, l.message])];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kusog_export.csv';
    a.click();
    URL.revokeObjectURL(url);
    sim.addLog('CSV log export triggered', 'info');
  };

  return (
    <div className="space-y-4">
      <PageHeader title="System Settings" subtitle="Hardware calibration, AI configuration, safety thresholds & data export" icon={<Settings className="h-5 w-5" />} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Hardware & Calibration */}
        <Panel title="Hardware & Calibration" icon={<Cpu className="h-4 w-4" />} right={<span className="font-mono text-[10px] text-slate-500">I2C · SPI</span>}>
          <div className="space-y-4">
            <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-slate-300">
                  <Gauge className="h-4 w-4 text-accent-400" /> Sensor Zero Calibration
                </span>
                {mpuZeroed && <span className="flex items-center gap-1 text-xs font-semibold text-ok-400"><CheckCircle2 className="h-3.5 w-3.5" /> Calibrated</span>}
              </div>
              <p className="mb-2 text-xs text-slate-500">Zeroes Load Cell and environmental sensor offsets before a test.</p>
              <button
                onClick={zeroSensors}
                className="flex items-center gap-2 rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-2 text-xs font-semibold text-accent-400 transition hover:bg-accent-500 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Run Zero Calibration
              </button>
            </div>

            <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-slate-300">Load Cell Offset (Tare)</span>
                <span className="font-mono text-sm font-bold text-accent-400">{loadCellOffset.toFixed(1)} N</span>
              </div>
              <input
                type="range"
                min={-5}
                max={5}
                step={0.1}
                value={loadCellOffset}
                onChange={(e) => setLoadCellOffset(+e.target.value)}
                className="slider"
                style={{ ['--val' as any]: `${((loadCellOffset + 5) / 10) * 100}%` }}
              />
              <button onClick={() => setLoadCellOffset(0)} className="mt-2 text-xs text-slate-500 hover:text-accent-400">
                Reset to zero
              </button>
            </div>

            <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
              <label className="mb-2 block text-sm text-slate-300">COM Port Selection</label>
              <div className="grid grid-cols-4 gap-1.5">
                {['COM1', 'COM2', 'COM3', 'COM4'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setComPort(p)}
                    className={`rounded-md border py-2 text-xs font-semibold transition ${
                      comPort === p
                        ? 'border-accent-500/40 bg-accent-500/15 text-accent-400'
                        : 'border-base-600/70 bg-base-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* AI & Computer Vision */}
        <Panel title="AI & Computer Vision" icon={<BrainCircuit className="h-4 w-4" />} right={<span className="font-mono text-[10px] text-slate-500">YOLOv8 · OpenCV</span>}>
          <div className="space-y-4">
            <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-slate-300">YOLO Confidence Threshold</span>
                <span className="font-mono text-sm font-bold text-accent-400">{yoloThreshold}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={yoloThreshold}
                onChange={(e) => setYoloThreshold(+e.target.value)}
                className="slider"
                style={{ ['--val' as any]: `${yoloThreshold}%` }}
              />
              <p className="mt-1 text-xs text-slate-500">Minimum confidence for bounding box detection.</p>
            </div>

            <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-slate-300">Inference FPS Cap</span>
                <span className="font-mono text-sm font-bold text-accent-400">{fpsCap} FPS</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[10, 15, 24, 30, 60].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFpsCap(f)}
                    className={`rounded-md border py-2 text-xs font-semibold transition ${
                      fpsCap === f
                        ? 'border-accent-500/40 bg-accent-500/15 text-accent-400'
                        : 'border-base-600/70 bg-base-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </Panel>

        {/* Safety Thresholds */}
        <Panel title="Safety Thresholds" icon={<ShieldAlert className="h-4 w-4" />} right={<span className="font-mono text-[10px] text-slate-500">Auto-Stop</span>}>
          <div className="space-y-4">
            <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-slate-300">Peak Force Auto-Stop Limit</span>
                <span className="font-mono text-sm font-bold text-danger-400">{maxForce.toFixed(0)} N</span>
              </div>
              <input
                type="range"
                min={10}
                max={60}
                step={1}
                value={maxForce}
                onChange={(e) => setMaxForce(+e.target.value)}
                className="slider"
                style={{ ['--val' as any]: `${((maxForce - 10) / 50) * 100}%` }}
              />
              <p className="mt-1 text-xs text-slate-500">Test auto-stops when base uplift force exceeds this value. Default: 45 N</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-warn-500/30 bg-warn-500/10 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs text-warn-400">
                <ShieldAlert className="h-4 w-4" /> Auto-stop armed
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-warn-400">
                <StatusDot color="warn" /> ACTIVE
              </span>
            </div>
          </div>
        </Panel>

        {/* Storage & Data Export */}
        <Panel title="Storage & Data Export" icon={<Database className="h-4 w-4" />} right={<span className="font-mono text-[10px] text-slate-500">Supabase / PostgreSQL</span>}>
          <div className="space-y-4">
            <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-slate-300">
                  <Database className="h-4 w-4 text-ok-400" /> Database Status
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-ok-500/10 px-2.5 py-1">
                  <StatusDot color="ok" />
                  <span className="text-xs font-semibold text-ok-400">CONNECTED</span>
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Test records are automatically saved to Supabase when a test stops.</p>
            </div>

            <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
              <p className="mb-2 text-sm text-slate-300">CSV Log Export</p>
              <p className="mb-3 text-xs text-slate-500">Export all test log entries to a CSV file.</p>
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
              <div className="flex justify-between py-0.5"><span className="text-slate-400">Uptime</span><span className="font-mono text-slate-200">{fmtElapsed(sim.elapsed)}</span></div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
