import { useState, useEffect } from 'react';
import { FileText, FileDown, CheckCircle2, Loader2, Eye, Archive, RefreshCw, Home } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import { fmtElapsed } from '@/hooks/useSimulation';
import { fetchTestRecords, type TestRecord } from '@/lib/testRecords';
import { generatePdf } from '@/lib/pdfReport';

type GenState = 'idle' | 'generating' | 'done';

export function ReportsView() {
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [genState, setGenState] = useState<GenState>('idle');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchTestRecords().then(({ data, error }) => {
      if (error) console.warn('Failed to load test records:', error.message);
      setRecords(data);
      if (data.length > 0) setSelected((s) => s || data[0].test_id);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const current = records.find((r) => r.test_id === selected) ?? null;

  const generate = async () => {
    if (!current) return;
    setGenState('generating');
    try {
      await generatePdf(current, new Date());
      setGenState('done');
      setTimeout(() => setGenState('idle'), 2500);
    } catch (e) {
      console.error(e);
      setGenState('idle');
    }
  };

  const resultLabel = (record: TestRecord) => {
    if (record.status === 'FAILED' || record.ai_overall === 'DAMAGE DETECTED') return 'Failed';
    if (record.status === 'COMPLETED' && record.ai_overall === 'PASSED') return 'Passed';
    if (record.status === 'RUNNING') return 'In progress';
    return 'Not assessed';
  };
  const resultColor = (record: TestRecord) =>
    resultLabel(record) === 'Failed'
      ? 'bg-danger-500/15 text-danger-400'
      : resultLabel(record) === 'Passed'
        ? 'bg-ok-500/15 text-ok-400'
        : record.status === 'RUNNING' ? 'bg-accent-500/15 text-accent-400' : 'bg-slate-500/15 text-slate-400';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Report Archive"
        subtitle="View completed tests and generate PDF reports"
        icon={<Archive className="h-5 w-5" />}
        right={
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-base-600/70 bg-base-700/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:text-white">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        {/* Test archive list */}
        <div className="col-span-12 xl:col-span-5">
          <Panel title="Test Archive" icon={<Archive className="h-4 w-4" />} bodyClassName="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading records…
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Archive className="h-10 w-10 text-slate-700" />
                <p className="mt-3 text-sm text-slate-500">No test records yet</p>
                <p className="text-xs text-slate-600">Complete a test to see it here</p>
              </div>
            ) : (
              <div className="divide-y divide-base-700/40">
                {records.map((t) => (
                  <button
                    key={t.test_id}
                    onClick={() => setSelected(t.test_id)}
                    className={`flex w-full items-start justify-between px-4 py-3 text-left transition ${selected === t.test_id ? 'bg-accent-500/10' : 'hover:bg-base-700/30'}`}
                  >
                    <div>
                      <p className={`font-mono text-sm font-semibold ${selected === t.test_id ? 'text-accent-400' : 'text-slate-200'}`}>{t.test_id}</p>
                      <p className="text-xs text-slate-500">{t.scenario}</p>
                      {t.house_model_name && (
                        <p className="flex items-center gap-1 text-[10px] text-slate-600 mt-0.5">
                          <Home className="h-2.5 w-2.5" /> {t.house_model_name}
                          {t.wall_material ? ` · ${t.wall_material}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${resultColor(t)}`}>{resultLabel(t)}</span>
                      <p className="mt-1 font-mono text-xs text-slate-500">{fmtElapsed(t.duration_seconds)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Preview & generate */}
        <div className="col-span-12 xl:col-span-7 space-y-4">
          <Panel title="Report Preview" icon={<Eye className="h-4 w-4" />}>
            {!current ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                <FileText className="h-10 w-10 text-slate-700" />
                <p className="mt-3 text-sm">Select a test record to preview</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-mono text-sm font-bold text-accent-400">{current.test_id}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${resultColor(current)}`}>{resultLabel(current)}</span>
                  </div>

                  {/* Test info */}
                  <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3 mb-3">
                    <PreviewItem label="Scenario" value={current.scenario} />
                    <PreviewItem label="Duration" value={fmtElapsed(current.duration_seconds)} />
                    <PreviewItem label="Wind Speed" value={`${current.wind_speed?.toFixed(1) ?? '—'} km/h`} />
                    <PreviewItem label="Force" value={`${current.current_force?.toFixed(1) ?? '—'} N`} />
                    <PreviewItem label="AI Confidence" value={`${current.ai_confidence ?? '—'}%`} />
                    <PreviewItem label="Overall" value={current.ai_overall ?? '—'} />
                  </div>

                  {/* House info */}
                  {(current.house_model_name || current.wall_material) && (
                    <div className="mt-3 border-t border-base-700/40 pt-3">
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        <Home className="h-3 w-3" /> House Information
                      </p>
                      {current.house_model_image_url && (
                        <img src={current.house_model_image_url} alt={current.house_model_name ?? ''} className="mb-2 h-24 w-full rounded-lg object-cover" />
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {current.house_model_name && <PreviewItem label="Model" value={current.house_model_name} />}
                        {current.wall_material    && <PreviewItem label="Wall" value={current.wall_material} />}
                        {current.roof_material    && <PreviewItem label="Roof" value={current.roof_material} />}
                        {current.floor_material   && <PreviewItem label="Floor" value={current.floor_material} />}
                        {current.other_materials  && <PreviewItem label="Other" value={current.other_materials} />}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-base-600/70 bg-base-900/40 p-3 text-xs text-slate-400">
                  <div className="flex justify-between py-0.5"><span>Format</span><span className="text-slate-200">PDF · A4</span></div>
                  <div className="flex justify-between py-0.5"><span>Includes</span><span className="text-slate-200">House Model, Sensors, AI, Camera, Logs</span></div>
                </div>

                <button
                  onClick={generate}
                  disabled={genState === 'generating'}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-widest transition disabled:opacity-70 ${
                    genState === 'done'
                      ? 'border border-ok-500/40 bg-ok-500 text-white'
                      : 'border border-ok-500/40 bg-ok-500/15 text-ok-400 hover:bg-ok-500 hover:text-white'
                  }`}
                >
                  {genState === 'generating' ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                  ) : genState === 'done' ? (
                    <><CheckCircle2 className="h-4 w-4" /> Report Downloaded</>
                  ) : (
                    <><FileDown className="h-4 w-4" /> Generate PDF Report</>
                  )}
                </button>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-slate-200">{value}</p>
    </div>
  );
}
