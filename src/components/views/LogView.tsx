import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { ScrollText, Search, Info, CheckCircle2, AlertTriangle, XCircle, Filter, Download, Plus, RefreshCw, Play, Check } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import type { Simulation, LogEntry } from '@/hooks/useSimulation';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';

const LEVEL_ICON = {
  info: { icon: Info, color: 'text-accent-400' },
  ok: { icon: CheckCircle2, color: 'text-ok-400' },
  warn: { icon: AlertTriangle, color: 'text-warn-400' },
  error: { icon: XCircle, color: 'text-danger-400' },
};

const LEVELS = ['all', 'info', 'ok', 'warn', 'error'] as const;

type TestRecord = {
  id: string;
  structure_name: string;
  wind_speed: number | null;
  wind_direction: number | null;
  rainfall_intensity: number | null;
  temperature: number | null;
  humidity: number | null;
  air_pressure: number | null;
  structural_tilt: number | null;
  structural_displacement: number | null;
  ai_observation: string | null;
  test_result: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
};

type TestForm = {
  structure_name: string;
  wind_speed: string;
  wind_direction: string;
  rainfall_intensity: string;
  temperature: string;
  humidity: string;
  air_pressure: string;
};

const EMPTY_FORM: TestForm = {
  structure_name: '',
  wind_speed: '',
  wind_direction: '',
  rainfall_intensity: '',
  temperature: '',
  humidity: '',
  air_pressure: '',
};

const formatDateTime = (value: string | null) => value ? new Date(value).toLocaleString() : '—';
const formatValue = (value: number | null) => value === null || value === undefined ? '—' : value;
const toNumberOrNull = (value: string) => value.trim() === '' ? null : Number(value);
const NUMERIC_FIELDS: Array<keyof TestForm> = [
  'wind_speed', 'wind_direction', 'rainfall_intensity', 'temperature', 'humidity', 'air_pressure',
];

export function LogView({ sim }: { sim: Simulation }) {
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<(typeof LEVELS)[number]>('all');
  const [testRecords, setTestRecords] = useState<TestRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isSavingTest, setIsSavingTest] = useState(false);
  const [testForm, setTestForm] = useState<TestForm>(EMPTY_FORM);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [activeTest, setActiveTest] = useState<TestRecord | null>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completionForm, setCompletionForm] = useState({
    structural_tilt: '',
    structural_displacement: '',
    ai_observation: '',
    test_result: 'PASS',
  });
  const [isCompletingTest, setIsCompletingTest] = useState(false);
  const { toast } = useToast();

  const loadTestRecords = async () => {
    setIsLoadingRecords(true);
    setRecordsError(null);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setRecordsError(userError?.message || 'You must be signed in to view simulation test records.');
      setTestRecords([]);
      setIsLoadingRecords(false);
      return;
    }

    const { data, error } = await supabase
      .from('test_logs')
      .select('*')
      .eq('operator_id', userData.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setRecordsError(error.message);
      setTestRecords([]);
    } else {
      const records = (data ?? []) as TestRecord[];
      setTestRecords(records);
      const running = records.find((record) => !record.completed_at && record.test_result === 'RUNNING') || null;
      setActiveTest(running);
      setActiveTestId(running?.id || null);
      setIsTestRunning(Boolean(running));
    }
    setIsLoadingRecords(false);
  };

  useEffect(() => {
    void loadTestRecords();
  }, []);

  const updateTestField = (field: keyof TestForm, value: string) => {
    setTestForm((current) => ({ ...current, [field]: value }));
  };

  const updateCompletionField = (field: keyof typeof completionForm, value: string) => {
    setCompletionForm((current) => ({ ...current, [field]: value }));
  };

  const getInvalidNumericField = (form: TestForm) => NUMERIC_FIELDS.find((field) => {
    const value = form[field];
    return value.trim() !== '' && !Number.isFinite(Number(value));
  });

  const startTest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingTest) return;
    if (!testForm.structure_name.trim()) {
      setRecordsError('Structure Name is required.');
      return;
    }
    const invalidField = getInvalidNumericField(testForm);
    if (invalidField) {
      setRecordsError(`${invalidField.replace(/_/g, ' ')} must be a valid number.`);
      return;
    }

    setIsSavingTest(true);
    setRecordsError(null);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setRecordsError(userError?.message || 'You must be signed in to save a simulation test.');
      setIsSavingTest(false);
      return;
    }

    const { data: runningRecords, error: runningError } = await supabase
      .from('test_logs')
      .select('*')
      .eq('operator_id', userData.user.id)
      .is('completed_at', null)
      .eq('test_result', 'RUNNING')
      .order('created_at', { ascending: false });

    if (runningError) {
      setRecordsError(runningError.message);
      setIsSavingTest(false);
      return;
    }
    const existingRunning = (runningRecords ?? [])[0] as TestRecord | undefined;
    if (existingRunning) {
      setActiveTest(existingRunning);
      setActiveTestId(existingRunning.id);
      setIsTestRunning(true);
      setIsTestModalOpen(false);
      setIsSavingTest(false);
      toast('There is already an active simulation test.', 'info');
      return;
    }

    const timestamp = new Date().toISOString();
    const { data: insertedRecord, error } = await supabase.from('test_logs').insert({
      operator_id: userData.user.id,
      structure_name: testForm.structure_name.trim(),
      wind_speed: toNumberOrNull(testForm.wind_speed),
      wind_direction: toNumberOrNull(testForm.wind_direction),
      rainfall_intensity: toNumberOrNull(testForm.rainfall_intensity),
      temperature: toNumberOrNull(testForm.temperature),
      humidity: toNumberOrNull(testForm.humidity),
      air_pressure: toNumberOrNull(testForm.air_pressure),
      test_result: 'RUNNING',
      started_at: timestamp,
      completed_at: null,
    }).select('*').single();

    setIsSavingTest(false);
    if (error) {
      setRecordsError(error.message);
      return;
    }

    setTestForm(EMPTY_FORM);
    setIsTestModalOpen(false);
    setActiveTest(insertedRecord as TestRecord);
    setActiveTestId(insertedRecord.id);
    setIsTestRunning(true);
    toast('Simulation test started.', 'success');
    await loadTestRecords();
  };

  const openCompletionModal = () => {
    if (!activeTest || !activeTestId) return;
    setCompletionForm({
      structural_tilt: activeTest.structural_tilt === null ? '' : String(activeTest.structural_tilt),
      structural_displacement: activeTest.structural_displacement === null ? '' : String(activeTest.structural_displacement),
      ai_observation: activeTest.ai_observation || '',
      test_result: activeTest.test_result === 'RUNNING' ? 'PASS' : activeTest.test_result || 'PASS',
    });
    setRecordsError(null);
    setIsCompleteModalOpen(true);
  };

  const completeTest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCompletingTest) return;
    if (!activeTestId) {
      setRecordsError('No active simulation test was found.');
      return;
    }
    if (completionForm.structural_tilt.trim() && !Number.isFinite(Number(completionForm.structural_tilt))) {
      setRecordsError('Structural tilt must be a valid number.');
      return;
    }
    if (completionForm.structural_displacement.trim() && !Number.isFinite(Number(completionForm.structural_displacement))) {
      setRecordsError('Structural displacement must be a valid number.');
      return;
    }

    setIsCompletingTest(true);
    setRecordsError(null);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setRecordsError(userError?.message || 'You must be signed in to complete a simulation test.');
      setIsCompletingTest(false);
      return;
    }

    const { error } = await supabase
      .from('test_logs')
      .update({
        completed_at: new Date().toISOString(),
        structural_tilt: toNumberOrNull(completionForm.structural_tilt),
        structural_displacement: toNumberOrNull(completionForm.structural_displacement),
        ai_observation: completionForm.ai_observation.trim() || null,
        test_result: completionForm.test_result,
      })
      .eq('id', activeTestId)
      .eq('operator_id', userData.user.id);

    setIsCompletingTest(false);
    if (error) {
      setRecordsError(error.message);
      return;
    }

    setActiveTestId(null);
    setActiveTest(null);
    setIsTestRunning(false);
    setIsCompleteModalOpen(false);
    toast('Simulation test completed successfully.', 'success');
    await loadTestRecords();
  };

  const filtered = useMemo(() => {
    let result = [...sim.logs].reverse();
    if (levelFilter !== 'all') result = result.filter((l) => l.level === levelFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((l) => l.message.toLowerCase().includes(q) || l.time.toLowerCase().includes(q));
    }
    return result;
  }, [sim.logs, query, levelFilter]);

  const exportCsv = () => {
    const rows = [['Time', 'Level', 'Message'], ...sim.logs.map((l) => [l.time, l.level, l.message])];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kusog_test_log.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Test Log" subtitle="Searchable, filterable system event log" icon={<ScrollText className="h-5 w-5" />} />

      <Panel
        title={`Simulation Test Records (${testRecords.length})`}
        icon={<RefreshCw className="h-4 w-4" />}
        bodyClassName="p-0"
      >
        <div className="flex items-center justify-between border-b border-base-600/60 p-3">
          <div>
            <p className="text-xs text-slate-400">Saved simulation results for the current account</p>
            {recordsError && <p className="mt-1 text-xs text-danger-400">{recordsError}</p>}
          </div>
          <button
            onClick={() => { setTestForm(EMPTY_FORM); setRecordsError(null); setIsTestModalOpen(true); }}
            disabled={isTestRunning}
            className="flex items-center gap-1.5 rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-2 text-xs font-semibold text-accent-400 transition hover:bg-accent-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> New Test
          </button>
        </div>

        {isTestRunning && activeTest && (
          <div className="border-b border-base-600/60 bg-accent-500/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-500/30 bg-base-900/40 p-3">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent-400">Active Test</p>
                <p className="text-sm font-semibold text-white">Structure: <span className="font-normal text-slate-300">{activeTest.structure_name}</span></p>
                <p className="text-xs text-slate-400">Status: <span className="font-semibold text-ok-400">● RUNNING</span></p>
                <p className="text-xs text-slate-400">Started: <span className="text-slate-300">{formatDateTime(activeTest.started_at)}</span></p>
                <p className="font-mono text-[10px] text-slate-500">Test ID: {activeTest.id}</p>
              </div>
              <button
                onClick={openCompletionModal}
                className="flex items-center gap-1.5 rounded-lg border border-ok-500/40 bg-ok-500/10 px-3 py-2 text-xs font-semibold text-ok-400 transition hover:bg-ok-500 hover:text-white"
              >
                <Check className="h-3.5 w-3.5" /> Complete Test
              </button>
            </div>
          </div>
        )}

        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="sticky top-0 bg-base-800">
              <tr className="border-b border-base-600/60 text-left text-[10px] uppercase tracking-widest text-slate-500">
                {['Test ID', 'Structure', 'Wind Speed', 'Rainfall', 'Temperature', 'Humidity', 'Structural Tilt', 'Structural Displacement', 'Test Result', 'Date/Time'].map((heading) => (
                  <th key={heading} className="px-4 py-2.5 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoadingRecords ? (
                <tr><td colSpan={10} className="py-10 text-center text-sm text-slate-500">Loading simulation tests...</td></tr>
              ) : testRecords.length === 0 ? (
                <tr><td colSpan={10} className="py-10 text-center text-sm text-slate-500">No simulation test records yet</td></tr>
              ) : testRecords.map((record) => (
                <tr key={record.id} className="border-b border-base-700/40 transition hover:bg-base-700/30">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{record.id}</td>
                  <td className="px-4 py-2.5 text-slate-300">{record.structure_name}</td>
                  <td className="px-4 py-2.5 text-slate-300">{formatValue(record.wind_speed)}</td>
                  <td className="px-4 py-2.5 text-slate-300">{formatValue(record.rainfall_intensity)}</td>
                  <td className="px-4 py-2.5 text-slate-300">{formatValue(record.temperature)}</td>
                  <td className="px-4 py-2.5 text-slate-300">{formatValue(record.humidity)}</td>
                  <td className="px-4 py-2.5 text-slate-300">{formatValue(record.structural_tilt)}</td>
                  <td className="px-4 py-2.5 text-slate-300">{formatValue(record.structural_displacement)}</td>
                  <td className="px-4 py-2.5 text-slate-300">{record.test_result || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{formatDateTime(record.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={`Event Log (${filtered.length} of ${sim.logs.length})`} icon={<ScrollText className="h-4 w-4" />} bodyClassName="p-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-base-600/60 p-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-base-600/70 bg-base-900/60 px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entries..."
              className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-500 hover:text-white">
                <XCircle className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
                  levelFilter === lvl
                    ? 'border-accent-500/40 bg-accent-500/15 text-accent-400'
                    : 'border-base-600/70 bg-base-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-ok-500/40 bg-ok-500/10 px-3 py-2 text-xs font-semibold text-ok-400 transition hover:bg-ok-500 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>

        {/* Table */}
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-base-800">
              <tr className="border-b border-base-600/60 text-left text-[10px] uppercase tracking-widest text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Time</th>
                <th className="px-4 py-2.5 font-semibold">Level</th>
                <th className="px-4 py-2.5 font-semibold">Message</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-sm text-slate-500">No matching entries</td>
                </tr>
              ) : (
                filtered.map((log: LogEntry) => {
                  const { icon: Icon, color } = LEVEL_ICON[log.level];
                  return (
                    <tr key={log.id} className="border-b border-base-700/40 transition hover:bg-base-700/30">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-500">{log.time}</td>
                      <td className="px-4 py-2.5">
                        <span className={`flex items-center gap-1.5 text-xs font-semibold ${color}`}>
                          <Icon className="h-3.5 w-3.5" /> {log.level.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">{log.message}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Modal
        open={isTestModalOpen}
        onClose={() => { if (!isSavingTest) setIsTestModalOpen(false); }}
        title="New Simulation Test"
        icon={<Plus className="h-4 w-4" />}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={startTest} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TestInput label="Structure Name" value={testForm.structure_name} onChange={(value) => updateTestField('structure_name', value)} required />
            <TestInput label="Wind Speed" type="number" value={testForm.wind_speed} onChange={(value) => updateTestField('wind_speed', value)} />
            <TestInput label="Wind Direction" type="number" value={testForm.wind_direction} onChange={(value) => updateTestField('wind_direction', value)} />
            <TestInput label="Rainfall Intensity" type="number" value={testForm.rainfall_intensity} onChange={(value) => updateTestField('rainfall_intensity', value)} />
            <TestInput label="Temperature" type="number" value={testForm.temperature} onChange={(value) => updateTestField('temperature', value)} />
            <TestInput label="Humidity" type="number" value={testForm.humidity} onChange={(value) => updateTestField('humidity', value)} />
            <TestInput label="Air Pressure" type="number" value={testForm.air_pressure} onChange={(value) => updateTestField('air_pressure', value)} />
          </div>
          {recordsError && <p className="text-xs text-danger-400">{recordsError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsTestModalOpen(false)} disabled={isSavingTest} className="rounded-lg border border-base-600/70 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:text-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={isSavingTest} className="flex items-center gap-1.5 rounded-lg border border-accent-500/40 bg-accent-500/15 px-3 py-2 text-xs font-semibold text-accent-400 transition hover:bg-accent-500 hover:text-white">
              <Play className="h-3.5 w-3.5" /> {isSavingTest ? 'Starting...' : 'START TEST'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={isCompleteModalOpen}
        onClose={() => { if (!isCompletingTest) setIsCompleteModalOpen(false); }}
        title="Complete Simulation Test"
        icon={<Check className="h-4 w-4" />}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={completeTest} className="space-y-4">
          {activeTest && (
            <div className="rounded-lg border border-base-600/70 bg-base-900/40 p-3 text-xs text-slate-400">
              <p>Structure: <span className="text-slate-200">{activeTest.structure_name}</span></p>
              <p>Test ID: <span className="font-mono text-slate-300">{activeTest.id}</span></p>
              <p>Started At: <span className="text-slate-300">{formatDateTime(activeTest.started_at)}</span></p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TestInput label="Structural Tilt" type="number" value={completionForm.structural_tilt} onChange={(value) => updateCompletionField('structural_tilt', value)} />
            <TestInput label="Structural Displacement" type="number" value={completionForm.structural_displacement} onChange={(value) => updateCompletionField('structural_displacement', value)} />
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">Test Result</span>
              <select
                value={completionForm.test_result}
                onChange={(event) => updateCompletionField('test_result', event.target.value)}
                className="w-full rounded-lg border border-base-600/70 bg-base-900/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent-500/50"
              >
                <option value="PASS">PASS</option>
                <option value="FAIL">FAIL</option>
                <option value="INCONCLUSIVE">INCONCLUSIVE</option>
              </select>
            </label>
          </div>
          <TestInput label="AI Observation" value={completionForm.ai_observation} onChange={(value) => updateCompletionField('ai_observation', value)} multiline />
          {recordsError && <p className="text-xs text-danger-400">{recordsError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsCompleteModalOpen(false)} disabled={isCompletingTest} className="rounded-lg border border-base-600/70 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:text-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={isCompletingTest} className="flex items-center gap-1.5 rounded-lg border border-ok-500/40 bg-ok-500/15 px-3 py-2 text-xs font-semibold text-ok-400 transition hover:bg-ok-500 hover:text-white">
              <Check className="h-3.5 w-3.5" /> {isCompletingTest ? 'Completing...' : 'Complete Test'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function TestInput({ label, value, onChange, type = 'text', required = false, multiline = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  const className = "w-full rounded-lg border border-base-600/70 bg-base-900/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-accent-500/50";
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}{required ? ' *' : ''}</span>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} className={`${className} min-h-20 resize-y`} />
      ) : (
        <input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className={className} />
      )}
    </label>
  );
}
