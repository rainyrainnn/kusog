import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileDown, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Panel } from '../Panel';
import {
  fetchTestRecordsWithSensorReadings,
  subscribeToSensorReadingsChanged,
  subscribeToTestRecordsChanged,
  type TestRecordWithSensorSummary,
} from '@/lib/testRecords';
import { generatePdf } from '@/lib/pdfReport';
import { getScenarioLabel, getStructuralDamageLabel } from '@/lib/testClassification';

type GenState = 'idle' | 'generating' | 'done';

export function ReportGeneration() {
  const [records, setRecords] = useState<TestRecordWithSensorSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [genState, setGenState] = useState<GenState>('idle');
  const [loading, setLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const currentRecord = useMemo(() => records.find((record) => record.id === selectedId) ?? null, [records, selectedId]);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    let pending = false;
    let inFlight = false;

    const loadRecords = async () => {
      if (inFlight) {
        pending = true;
        return;
      }
      inFlight = true;
      do {
        pending = false;
        const currentRequest = ++requestId;
        setLoading(true);
        try {
          const response = await fetchTestRecordsWithSensorReadings();
          if (!active || currentRequest !== requestId) continue;
          if (response.error) {
            setRecordsError(response.error.message);
          } else {
            setRecordsError(null);
            setRecords(response.data);
            setSelectedId((id) => response.data.some((record) => record.id === id) ? id : response.data[0]?.id ?? '');
          }
        } catch (error) {
          if (active) setRecordsError(error instanceof Error ? error.message : 'Unable to load saved test records.');
        } finally {
          if (active) setLoading(false);
        }
      } while (active && pending);
      inFlight = false;
    };

    void loadRecords();
    const unsubscribeRecords = subscribeToTestRecordsChanged(() => void loadRecords());
    const unsubscribeReadings = subscribeToSensorReadingsChanged(() => void loadRecords());
    return () => {
      active = false;
      unsubscribeRecords();
      unsubscribeReadings();
    };
  }, []);

  const generate = async () => {
    if (!currentRecord || genState === 'generating') return;
    setGenState('generating');
    setGenerationError(null);
    try {
      await generatePdf(currentRecord, new Date());
      setGenState('done');
      window.setTimeout(() => setGenState('idle'), 2500);
    } catch (error) {
      console.error('Unable to generate saved test report:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unable to generate the PDF report.');
      setGenState('idle');
    }
  };

  return (
    <Panel title="Generate Test Report" icon={<FileText className="h-4 w-4" />} className="h-full">
      <div className="flex h-full flex-col gap-4">
        <div>
          <label htmlFor="saved-test-report" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Saved test record
          </label>
          <select
            id="saved-test-report"
            value={selectedId}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setGenState('idle');
              setGenerationError(null);
            }}
            disabled={loading || records.length === 0}
            className="w-full rounded-lg border border-base-600/70 bg-base-900/70 px-3 py-2.5 text-xs font-mono text-slate-200 disabled:opacity-60"
          >
            {records.length === 0
              ? <option value="">{loading ? 'Loading saved records…' : 'No saved test records'}</option>
              : records.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.test_id} · {record.status} · {record.start_time ? formatDate(record.start_time) : '--'}
                </option>
              ))}
          </select>
        </div>

        {recordsError && (
          <p role="alert" className="rounded-lg border border-danger-400/20 bg-danger-400/[0.05] p-3 text-xs text-danger-300">
            Unable to load saved records: {recordsError}
          </p>
        )}

        {loading && records.length === 0 ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-6 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading saved records…
          </div>
        ) : !currentRecord ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-base-600/70 bg-base-900/30 p-5 text-center">
            <FileText className="h-7 w-7 text-slate-600" aria-hidden="true" />
            <p className="mt-2 text-xs font-semibold text-slate-300">{recordsError ? 'Records unavailable' : 'No saved test to report'}</p>
            <p className="mt-1 text-[10px] text-slate-500">{recordsError ? 'Refresh records to try again.' : 'Reports can only be generated from an actual saved test record.'}</p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('kusog:test-records-changed'))}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-base-600/70 px-3 py-1.5 text-[10px] font-semibold text-slate-300 hover:text-accent-300 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        ) : (
          <>
            <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-3 rounded-lg border border-base-600/70 bg-base-900/40 p-3 text-xs">
              <PreviewItem label="Test ID" value={currentRecord.test_id || '--'} />
              <PreviewItem label="Operator ID" value={currentRecord.operator_id || '--'} />
              <PreviewItem label="Scenario" value={getScenarioLabel(currentRecord.scenario, currentRecord.test_mode)} />
              <PreviewItem label="Record status" value={currentRecord.status || '--'} />
              <PreviewItem label="Started" value={formatDate(currentRecord.start_time)} />
              <PreviewItem label="Ended" value={formatDate(currentRecord.end_time)} />
              <PreviewItem label="Duration" value={formatDuration(currentRecord.duration_seconds)} />
              <PreviewItem label="Result" value={getResult(currentRecord)} />
              <PreviewItem label="Wind speed" value={currentRecord.wind_speed_kmh === null ? '--' : `${currentRecord.wind_speed_kmh.toFixed(1)} km/h`} />
              <PreviewItem label="Wind direction" value={currentRecord.wind_direction_degrees === null ? '--' : `${currentRecord.wind_direction_degrees.toFixed(1)}°`} />
              <PreviewItem label="Uplift force" value={currentRecord.uplift_force_n === null ? '--' : `${currentRecord.uplift_force_n.toFixed(2)} N`} />
              <PreviewItem label="BMP280 temperature" value={currentRecord.bmp280_temperature_c === null ? '--' : `${currentRecord.bmp280_temperature_c.toFixed(1)} °C`} />
              <PreviewItem label="BMP280 atmospheric pressure" value={currentRecord.bmp280_pressure_hpa === null ? '--' : `${currentRecord.bmp280_pressure_hpa.toFixed(1)} hPa`} />
              <PreviewItem label="Rainfall (24 h)" value={currentRecord.rain_reading_24h === null ? '--' : `${currentRecord.rain_reading_24h} (API unit)`} />
              <PreviewItem label="Saved detection labels" value={currentRecord.ai_cracks || '--'} />
              <PreviewItem label="Saved AI confidence" value={currentRecord.ai_confidence === null ? '--' : `${currentRecord.ai_confidence}%`} />
              <PreviewItem label="Structural assessment" value={getStructuralDamageLabel(currentRecord.structural_damage_status, currentRecord.ai_overall)} />
            </div>
            <p className="text-[10px] leading-relaxed text-slate-500">
              AI detection metadata reflects saved record fields only. Structural assessment is shown separately and is not inferred from object labels.
            </p>
          </>
        )}

        {generationError && <p role="alert" className="text-xs text-danger-300">{generationError}</p>}
        <button
          type="button"
          onClick={() => void generate()}
          disabled={!currentRecord || genState === 'generating' || loading}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-xs font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 ${
            genState === 'done'
              ? 'border-ok-500/40 bg-ok-500 text-white'
              : 'border-ok-500/40 bg-ok-500/10 text-ok-300 hover:bg-ok-500 hover:text-white'
          }`}
        >
          {genState === 'generating'
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating PDF…</>
            : genState === 'done'
              ? <><CheckCircle2 className="h-4 w-4" /> Report downloaded</>
              : <><FileDown className="h-4 w-4" /> Generate PDF report</>}
        </button>
      </div>
    </Panel>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '--';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '--' : parsed.toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '--';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
}

function getResult(record: TestRecordWithSensorSummary): string {
  if (record.status === 'FAILED') return 'FAILED';
  if (record.status === 'RUNNING') return 'RUNNING';
  if (record.status === 'COMPLETED') return 'NOT ASSESSED';
  return record.status || '--';
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-words text-[11px] text-slate-200">{value}</p>
    </div>
  );
}
