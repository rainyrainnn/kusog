import { useState } from 'react';
import { FileText, FileDown, ChevronDown, CheckCircle2, Loader2 } from 'lucide-react';
import { Panel } from '../Panel';
import { fmtElapsed, type Simulation } from '@/hooks/useSimulation';
import { fetchTestRecords, type TestRecord } from '@/lib/testRecords';
import { generatePdf } from '@/lib/pdfReport';
import { useEffect } from 'react';

type GenState = 'idle' | 'generating' | 'done';

export function ReportGeneration({ sim }: { sim: Simulation }) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [genState, setGenState] = useState<GenState>('idle');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTestRecords().then(({ data }) => {
      setRecords(data);
      if (data.length > 0) setSelected((current) => current || data[0].test_id);
      setLoading(false);
    });
  }, []);

  const currentRecord = records.find((r) => r.test_id === selected) ?? null;

  const generate = async () => {
    setGenState('generating');
    try {
      const now = new Date();
      const record = currentRecord ?? {
        test_id: sim.testId || 'LIVE',
        scenario: sim.scenario,
        start_time: sim.startTime?.toISOString() ?? null,
        end_time: null,
        duration_seconds: sim.elapsed,
        status: sim.isTestRunning ? 'RUNNING' : 'LIVE',
        house_model_name: sim.house.modelName || null,
        house_model_image_url: sim.house.modelImageUrl || null,
        wall_material: sim.house.wallMaterial || null,
        roof_material: sim.house.roofMaterial || null,
        floor_material: sim.house.floorMaterial || null,
        other_materials: sim.house.otherMaterials || null,
        wind_speed: sim.windSensorConnected ? sim.windSpeed * 3.6 : null,
        temperature: null,
        humidity: null,
        pressure: null,
        current_force: sim.loadCellConnected ? sim.currentForce : null,
        ai_confidence: sim.aiDetections.overall === 'NOT ASSESSED' ? null : sim.aiConfidence,
        ai_roof: sim.aiDetections.roof,
        ai_movement: sim.aiDetections.movement,
        ai_cracks: sim.aiDetections.cracks,
        ai_overall: sim.aiDetections.overall,
        fan_speed: 0,
        wind_direction: sim.windSensorConnected ? sim.windDir : null,
        camera_status: 'disconnected',
        camera_stream_url: null,
        log_entries: sim.logs.slice(-10),
      } as Partial<TestRecord> as TestRecord;

      await generatePdf(record, now);
      setGenState('done');
      setTimeout(() => setGenState('idle'), 2500);
    } catch (e) {
      console.error(e);
      setGenState('idle');
    }
  };

  const displayList = records.length > 0 ? records : sim.testId ? [{ test_id: sim.testId } as TestRecord] : [];

  return (
    <Panel title="Report Generation" icon={<FileText className="h-4 w-4" />} className="h-full">
      <div className="flex h-full flex-col justify-center gap-4">
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Select Test
          </label>
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-lg border border-base-600/70 bg-base-900/60 px-3 py-2.5 text-sm text-slate-200 transition hover:border-accent-500/50"
            >
              <span className="font-mono text-xs">{selected || (loading ? 'Loading…' : 'No tests saved yet')}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && displayList.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto overflow-hidden rounded-lg border border-base-600/70 bg-base-800 shadow-panel">
                {displayList.map((t) => (
                  <li key={t.test_id}>
                    <button
                      onClick={() => { setSelected(t.test_id); setOpen(false); }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left font-mono text-xs transition hover:bg-base-700/60 ${t.test_id === selected ? 'text-accent-400' : 'text-slate-300'}`}
                    >
                      {t.test_id}
                      {t.test_id === selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {currentRecord && (
          <div className="rounded-lg border border-base-600/70 bg-base-900/40 p-3 text-xs text-slate-400 space-y-1">
            {currentRecord.house_model_name && (
              <div className="flex justify-between"><span>Model</span><span className="text-slate-200">{currentRecord.house_model_name}</span></div>
            )}
            {currentRecord.wall_material && (
              <div className="flex justify-between"><span>Wall</span><span className="text-slate-200">{currentRecord.wall_material}</span></div>
            )}
            {currentRecord.roof_material && (
              <div className="flex justify-between"><span>Roof</span><span className="text-slate-200">{currentRecord.roof_material}</span></div>
            )}
            <div className="flex justify-between"><span>Status</span><span className="text-slate-200">{currentRecord.status}</span></div>
            <div className="flex justify-between"><span>Duration</span><span className="font-mono text-slate-200">{fmtElapsed(currentRecord.duration_seconds)}</span></div>
          </div>
        )}

        {!currentRecord && (
          <div className="rounded-lg border border-base-600/70 bg-base-900/40 p-3 text-xs text-slate-400">
            <div className="flex justify-between py-0.5"><span>Format</span><span className="text-slate-200">PDF · A4</span></div>
            <div className="flex justify-between py-0.5"><span>Includes</span><span className="text-slate-200">House Model, Sensors, AI</span></div>
            <div className="flex justify-between py-0.5"><span>Data</span><span className="text-slate-200">Live session values</span></div>
          </div>
        )}

        <button
          onClick={generate}
          disabled={genState === 'generating'}
          className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-widest transition disabled:opacity-70 ${
            genState === 'done'
              ? 'border border-ok-500/40 bg-ok-500 text-white'
              : 'border border-ok-500/40 bg-ok-500/15 text-ok-400 hover:bg-ok-500 hover:text-white'
          }`}
        >
          {genState === 'generating' ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
          ) : genState === 'done' ? (
            <><CheckCircle2 className="h-4 w-4" /> Report Downloaded</>
          ) : (
            <><FileDown className="h-4 w-4" /> Generate PDF Report</>
          )}
        </button>
      </div>
    </Panel>
  );
}
