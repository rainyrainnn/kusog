import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Archive, CheckCircle2, FileDown, FileText, Filter, Loader2, RefreshCw, Search, XCircle } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import {
  fetchTestRecordsWithSensorReadings,
  subscribeToSensorReadingsChanged,
  subscribeToTestRecordsChanged,
  type TestRecordWithSensorSummary,
} from '@/lib/testRecords';
import { generatePdf } from '@/lib/pdfReport';
import { getScenarioLabel, getStructuralDamageLabel, getWeatherStatusLabel } from '@/lib/testClassification';

type GenerationState = 'idle' | 'generating' | 'done';
const REPORT_STATUSES = ['ALL', 'RUNNING', 'COMPLETED', 'FAILED'] as const;

export function ReportsView() {
  const [records, setRecords] = useState<TestRecordWithSensorSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [recordQuery, setRecordQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof REPORT_STATUSES)[number]>('ALL');
  const [generationState, setGenerationState] = useState<GenerationState>('idle');
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const initializedSelection = useRef(false);
  const selectedRecord = useMemo(() => records.find((record) => record.id === selectedId) ?? null, [records, selectedId]);
  const filteredRecords = useMemo(() => {
    const search = recordQuery.trim().toLowerCase();
    return records.filter((record) => {
      if (statusFilter !== 'ALL' && record.status.toUpperCase() !== statusFilter) return false;
      if (!search) return true;
      return [record.test_id, record.scenario, record.test_mode, record.status]
        .some((value) => value?.toLowerCase().includes(search));
    });
  }, [records, recordQuery, statusFilter]);
  const recordSummary = useMemo(() => ({
    total: records.length,
    completed: records.filter((record) => record.status.toUpperCase() === 'COMPLETED').length,
    failed: records.filter((record) => record.status.toUpperCase() === 'FAILED').length,
    exportable: records.length,
  }), [records]);

  useEffect(() => {
    let active = true;
    let loadingRecords = false;
    let refreshPending = false;
    const load = async () => {
      if (loadingRecords) {
        refreshPending = true;
        return;
      }
      loadingRecords = true;
      do {
        refreshPending = false;
        setLoading(true);
        try {
          const response = await fetchTestRecordsWithSensorReadings();
          if (!active) continue;
          if (response.error) {
            setRecordsError(response.error.message);
          } else {
            setRecordsError(null);
            setRecords(response.data);
            setSelectedId((id) => {
              if (!initializedSelection.current) {
                initializedSelection.current = true;
                return response.data[0]?.id ?? '';
              }
              return response.data.some((record) => record.id === id) ? id : '';
            });
          }
        } catch (error) {
          if (active) setRecordsError(error instanceof Error ? error.message : 'Unable to load saved test records.');
        } finally {
          if (active) setLoading(false);
        }
      } while (active && refreshPending);
      loadingRecords = false;
    };

    void load();
    const unsubscribeRecords = subscribeToTestRecordsChanged(() => void load());
    const unsubscribeReadings = subscribeToSensorReadingsChanged(() => void load());
    return () => {
      active = false;
      unsubscribeRecords();
      unsubscribeReadings();
    };
  }, []);

  const generate = async () => {
    if (!selectedRecord || generationState === 'generating') return;
    setGenerationState('generating');
    setGenerationError(null);
    setGeneratedAt(null);
    try {
      const reportDate = new Date();
      await generatePdf(selectedRecord, reportDate);
      setGeneratedAt(reportDate);
      setGenerationState('done');
      window.setTimeout(() => setGenerationState('idle'), 2500);
    } catch (error) {
      console.error('Unable to generate saved test report:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unable to generate the PDF report.');
      setGenerationState('idle');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Generate a PDF report from an operator-owned saved test record and its associated sensor readings."
        icon={<Archive className="h-5 w-5" />}
        right={
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('kusog:test-records-changed'))}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-base-600/70 bg-base-900/60 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-accent-300 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />

      <section aria-label="Report record summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard label="Available records" value={summaryValue(loading, recordsError, records.length, recordSummary.total)} icon={<Archive className="h-4 w-4" />} tone="text-accent-300" />
        <SummaryCard label="Completed tests" value={summaryValue(loading, recordsError, records.length, recordSummary.completed)} icon={<CheckCircle2 className="h-4 w-4" />} tone="text-ok-300" />
        <SummaryCard label="Failed tests" value={summaryValue(loading, recordsError, records.length, recordSummary.failed)} icon={<XCircle className="h-4 w-4" />} tone="text-danger-300" />
        <SummaryCard label="Reports available" value={summaryValue(loading, recordsError, records.length, recordSummary.exportable)} icon={<FileDown className="h-4 w-4" />} tone="text-sky-300" />
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-4">
          <Panel title={`Select test record (${filteredRecords.length}${filteredRecords.length !== records.length ? ` of ${records.length}` : ''})`} icon={<Archive className="h-4 w-4" />} bodyClassName="p-0">
            <div className="grid gap-2 border-b border-base-600/60 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="flex min-w-0 items-center gap-2 rounded-lg border border-base-600/70 bg-base-950/50 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <input
                  type="search"
                  value={recordQuery}
                  onChange={(event) => setRecordQuery(event.target.value)}
                  placeholder="Search ID, scenario, or status"
                  aria-label="Search report records"
                  className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
                />
              </label>
              <label className="flex min-w-0 items-center gap-2 rounded-lg border border-base-600/70 bg-base-950/50 px-3 py-2">
                <Filter className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span className="text-[10px] text-slate-500">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as (typeof REPORT_STATUSES)[number])}
                  aria-label="Filter report records by status"
                  className="min-w-0 bg-transparent text-xs text-slate-200 outline-none"
                >
                  {REPORT_STATUSES.map((status) => <option key={status} value={status}>{status === 'ALL' ? 'All' : status}</option>)}
                </select>
              </label>
            </div>
            {recordsError && (
              <p role="alert" className="m-3 rounded-lg border border-danger-400/20 bg-danger-400/[0.05] p-3 text-xs text-danger-300">
                Unable to load saved records: {recordsError}
              </p>
            )}
            {loading && records.length === 0 ? (
              <div role="status" className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading saved records…
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <Archive className="h-8 w-8 text-slate-700" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-300">{recordsError ? 'Records unavailable' : 'No saved test records'}</p>
                <p className="mt-1 text-xs text-slate-500">{recordsError ? 'Refresh to try loading your records again.' : 'Generate a report after a test record has been saved.'}</p>
              </div>
            ) : (
              filteredRecords.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Search className="mx-auto h-6 w-6 text-slate-600" aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium text-slate-300">No matching records</p>
                  <p className="mt-1 text-xs text-slate-500">Change the search or status filter.</p>
                </div>
              ) : <ul className="max-h-[70vh] divide-y divide-base-700/50 overflow-y-auto">
                {filteredRecords.map((record) => {
                  const selected = selectedId === record.id;
                  return (
                    <li key={record.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(record.id);
                          setGenerationState('idle');
                          setGeneratedAt(null);
                          setGenerationError(null);
                        }}
                        aria-pressed={selected}
                        className={`w-full border-l-2 px-3 py-3 text-left transition-colors sm:px-4 ${selected ? 'border-accent-400 bg-accent-500/[0.08]' : 'border-transparent hover:bg-white/[0.025]'}`}
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className={`break-all font-mono text-xs font-semibold ${selected ? 'text-accent-300' : 'text-slate-200'}`}>{record.test_id || '--'}</p>
                            <p className="mt-1 truncate text-[10px] text-slate-400">{getScenarioLabel(record.scenario, record.test_mode)}</p>
                            <p className="mt-1 text-[10px] text-slate-500">Started {formatDate(record.start_time)}</p>
                            <p className="mt-1 text-[10px] text-slate-500">Ended {formatDate(record.end_time)} <span className="mx-1 text-slate-700">·</span> {formatDuration(record.duration_seconds)}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold tracking-wider ${statusStyle(record.status)}`}>
                            {record.status || '--'}
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-400">Result: <span className="font-semibold text-slate-300">{resultLabel(record)}</span></p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-8">
          <Panel title="Selected report summary" icon={<FileText className="h-4 w-4" />}>
            {!selectedRecord ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto h-8 w-8 text-slate-700" aria-hidden="true" />
                <p className="mt-3 text-sm text-slate-400">Select a saved test record to review its report data.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[10px] leading-relaxed text-slate-500">
                  This is a summary of saved report data, not a rendered PDF preview. The PDF is assembled when you export it.
                </p>
                <div className="flex flex-col gap-3 border-b border-sky-200/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">KUSOG test report</p>
                    <h2 className="mt-1 break-all font-mono text-base font-bold text-slate-100">{selectedRecord.test_id || '--'}</h2>
                    <p className="mt-1 text-xs text-slate-400">{getScenarioLabel(selectedRecord.scenario, selectedRecord.test_mode)}</p>
                  </div>
                  <span className={`w-fit rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-wider ${statusStyle(selectedRecord.status)}`}>
                    {selectedRecord.status || '--'}
                  </span>
                </div>

                <PreviewSection title="Test summary">
                  <PreviewItem label="Test ID" value={selectedRecord.test_id || '--'} />
                  <PreviewItem label="Operator ID" value={selectedRecord.operator_id || '--'} />
                  <PreviewItem label="Scenario" value={getScenarioLabel(selectedRecord.scenario, selectedRecord.test_mode)} />
                  <PreviewItem label="Started" value={formatDate(selectedRecord.start_time)} />
                  <PreviewItem label="Ended" value={formatDate(selectedRecord.end_time)} />
                  <PreviewItem label="Duration" value={formatDuration(selectedRecord.duration_seconds)} />
                  <PreviewItem label="Result" value={resultLabel(selectedRecord)} />
                  <PreviewItem label="Test mode" value={selectedRecord.test_mode || '--'} />
                  <PreviewItem label="Actual weather" value={getWeatherStatusLabel(selectedRecord.actual_weather_status)} />
                  <PreviewItem label="Report generated" value={generatedAt ? formatDate(generatedAt.toISOString()) : '--'} />
                </PreviewSection>

                <PreviewSection title="Wind measurements">
                  <PreviewItem label="Wind speed" value={selectedRecord.wind_speed_kmh === null ? '--' : `${selectedRecord.wind_speed_kmh.toFixed(2)} km/h`} />
                  <PreviewItem label="Wind direction" value={selectedRecord.wind_direction_degrees === null ? '--' : `${selectedRecord.wind_direction_degrees.toFixed(1)}°`} />
                  <PreviewItem label="Wind reading time" value={formatDate(selectedRecord.wind_reading_recorded_at)} />
                </PreviewSection>

                <PreviewSection title="BMP280 measurements">
                  <PreviewItem label="Temperature" value={selectedRecord.bmp280_temperature_c === null ? '--' : `${selectedRecord.bmp280_temperature_c.toFixed(1)} °C`} />
                  <PreviewItem label="Atmospheric pressure" value={selectedRecord.bmp280_pressure_hpa === null ? '--' : `${selectedRecord.bmp280_pressure_hpa.toFixed(1)} hPa`} />
                  <PreviewItem label="BMP280 reading time" value={formatDate(selectedRecord.bmp280_reading_recorded_at)} />
                </PreviewSection>

                <PreviewSection title="Rainfall measurements">
                  <PreviewItem label="Rain level" value={selectedRecord.rain_reading_level || selectedRecord.rain_level_raw || selectedRecord.rain_level || '--'} />
                  <PreviewItem label="Rain state" value={selectedRecord.rain_reading_state || selectedRecord.rain_state || '--'} />
                  <PreviewItem label="Rainfall (24 h)" value={selectedRecord.rain_reading_24h === null ? '--' : `${selectedRecord.rain_reading_24h} (API unit)`} />
                  <PreviewItem
                    label="Rain sensor battery"
                    value={selectedRecord.rain_reading_battery_percentage !== null && selectedRecord.rain_reading_battery_percentage !== undefined
                      ? `${selectedRecord.rain_reading_battery_percentage}%`
                      : selectedRecord.rain_battery !== null && selectedRecord.rain_battery !== undefined
                        ? `${selectedRecord.rain_battery}%`
                        : '--'}
                  />
                  <PreviewItem label="Rain reading time" value={formatDate(selectedRecord.rain_reading_recorded_at || selectedRecord.rain_sensor_reading_recorded_at || null)} />
                </PreviewSection>

                <PreviewSection title="Uplift force measurement">
                  <PreviewItem label="Uplift force" value={selectedRecord.uplift_force_n === null ? '--' : `${selectedRecord.uplift_force_n.toFixed(2)} N`} />
                  <PreviewItem label="Load-cell reading time" value={formatDate(selectedRecord.load_cell_reading_recorded_at)} />
                </PreviewSection>

                <PreviewSection title="AI record details">
                  <PreviewItem label="Saved detection labels / notes" value={selectedRecord.ai_cracks || '--'} />
                  <PreviewItem label="Saved confidence" value={selectedRecord.ai_confidence === null ? '--' : `${selectedRecord.ai_confidence}%`} />
                  <PreviewItem label="Structural damage assessment" value={getStructuralDamageLabel(selectedRecord.structural_damage_status, selectedRecord.ai_overall)} />
                </PreviewSection>
                <PreviewSection title="Additional saved test details">
                  <PreviewItem label="House model" value={selectedRecord.house_model_name || '--'} />
                  <PreviewItem label="Wall material" value={selectedRecord.wall_material || '--'} />
                  <PreviewItem label="Roof material" value={selectedRecord.roof_material || '--'} />
                  <PreviewItem label="Floor material" value={selectedRecord.floor_material || '--'} />
                  <PreviewItem label="Other materials" value={selectedRecord.other_materials || '--'} />
                  <PreviewItem label="Saved camera status" value={selectedRecord.camera_status || '--'} />
                </PreviewSection>
                <p className="text-[10px] leading-relaxed text-slate-500">
                  Detection metadata is included only when saved on this record. Object detection and structural damage assessment are shown separately.
                </p>
              </div>
            )}
          </Panel>

          {generationError && <p role="alert" className="rounded-lg border border-danger-400/20 bg-danger-400/[0.05] p-3 text-xs text-danger-300">{generationError}</p>}
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!selectedRecord || loading || generationState === 'generating'}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-xs font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 ${
              generationState === 'done'
                ? 'border-ok-500/40 bg-ok-500 text-white'
                : 'border-ok-500/40 bg-ok-500/10 text-ok-300 hover:bg-ok-500 hover:text-white'
            }`}
          >
            {generationState === 'generating'
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating PDF…</>
              : generationState === 'done'
                ? <><CheckCircle2 className="h-4 w-4" /> Report downloaded</>
                : <><FileDown className="h-4 w-4" /> Generate PDF{selectedRecord ? ` · ${selectedRecord.test_id || 'selected test'}` : ''}</>}
          </button>
          {generationState === 'done' && <p role="status" className="text-center text-[10px] text-ok-300">PDF generated from the selected record.</p>}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '--';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
}

function resultLabel(record: TestRecordWithSensorSummary): string {
  if (record.status === 'FAILED') return 'FAILED';
  if (record.status === 'RUNNING') return 'RUNNING';
  if (record.status === 'COMPLETED') return 'NOT ASSESSED';
  return record.status || '--';
}

function statusStyle(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'RUNNING') return 'border-accent-400/20 bg-accent-400/[0.08] text-accent-300';
  if (normalized === 'COMPLETED') return 'border-ok-400/20 bg-ok-400/[0.06] text-ok-300';
  if (normalized === 'FAILED') return 'border-danger-400/20 bg-danger-400/[0.08] text-danger-300';
  return 'border-slate-400/15 bg-slate-400/[0.05] text-slate-400';
}

function summaryValue(loading: boolean, error: string | null, recordCount: number, value: number): number | string {
  return recordCount === 0 && (loading || error) ? '--' : value;
}

function SummaryCard({ label, value, icon, tone }: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-base-600/70 bg-base-900/70 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">{label}</p>
        <span className={tone} aria-hidden="true">{icon}</span>
      </div>
      <p className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${tone}`} aria-live="polite">{value}</p>
    </article>
  );
}

function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-base-600/60 bg-base-900/40 p-3 sm:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-words text-[11px] text-slate-200">{value}</p>
    </div>
  );
}
