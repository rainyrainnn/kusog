import { useState, useMemo, useEffect } from 'react';
import { ScrollText, Search, Info, CheckCircle2, AlertTriangle, XCircle, Filter, Download, RefreshCw } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import type { Simulation, LogEntry } from '@/hooks/useSimulation';
import { fetchTestRecordsWithSensorReadings, subscribeToTestRecordsChanged, type TestRecordWithSensorSummary } from '@/lib/testRecords';

const LEVEL_ICON = {
  info: { icon: Info, color: 'text-accent-400' },
  ok: { icon: CheckCircle2, color: 'text-ok-400' },
  warn: { icon: AlertTriangle, color: 'text-warn-400' },
  error: { icon: XCircle, color: 'text-danger-400' },
};

const LEVELS = ['all', 'info', 'ok', 'warn', 'error'] as const;

const formatDateTime = (value: string | null) => value ? new Date(value).toLocaleString() : '—';
const formatValue = (value: number | string | null | undefined) => value === null || value === undefined ? '—' : value;
const testResult = (record: TestRecordWithSensorSummary) => {
  if (record.status === 'FAILED' || record.ai_overall === 'DAMAGE DETECTED') return 'Failed';
  if (record.status === 'COMPLETED' && record.ai_overall === 'PASSED') return 'Passed';
  if (record.status === 'RUNNING') return 'In progress';
  return 'Not assessed';
};

export function LogView({ sim }: { sim: Simulation }) {
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<(typeof LEVELS)[number]>('all');
  const [testRecords, setTestRecords] = useState<TestRecordWithSensorSummary[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const loadTestRecords = async () => {
    const { data, error } = await fetchTestRecordsWithSensorReadings();
    setRecordsError(error?.message ?? null);
    setTestRecords(data);
    setIsLoadingRecords(false);
  };

  useEffect(() => {
    void loadTestRecords();
    const unsubscribe = subscribeToTestRecordsChanged(() => void loadTestRecords());
    const interval = window.setInterval(() => void loadTestRecords(), 15000);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

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
            <p className="text-xs text-slate-400">Automatically created when a simulation starts and finalized when it stops.</p>
            {recordsError && <p className="mt-1 text-xs text-danger-400">{recordsError}</p>}
          </div>
          <button
            onClick={() => void loadTestRecords()}
            className="grid h-9 w-9 place-items-center rounded-md border border-base-600 bg-base-800 text-slate-300 hover:text-accent-300"
            title="Refresh test records"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="sticky top-0 bg-base-800">
              <tr className="border-b border-base-600/60 text-left text-[10px] uppercase tracking-widest text-slate-500">
                {['Test ID', 'Started', 'Ended', 'Duration', 'Result', 'Wind Speed (km/h)', 'Wind Direction', 'Uplift Force (N)'].map((heading) => (
                  <th key={heading} className="px-4 py-2.5 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoadingRecords ? (
                <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-500">Loading simulation tests...</td></tr>
              ) : testRecords.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-500">No simulation test records yet</td></tr>
              ) : testRecords.map((record) => (
                <tr key={record.id} className="border-b border-base-700/40 transition hover:bg-base-700/30">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-200">{record.test_id}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-300">{formatDateTime(record.start_time)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-300">{formatDateTime(record.end_time)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-300">{record.duration_seconds === null ? '—' : `${Math.floor(record.duration_seconds / 60).toString().padStart(2, '0')}:${Math.floor(record.duration_seconds % 60).toString().padStart(2, '0')}`}</td>
                  <td className={`px-4 py-2.5 text-xs font-semibold ${testResult(record) === 'Failed' ? 'text-danger-400' : testResult(record) === 'Passed' ? 'text-ok-400' : 'text-slate-300'}`}>{testResult(record)}</td>
                  <td className="px-4 py-2.5 text-slate-300">{record.wind_speed_kmh === null ? '—' : record.wind_speed_kmh.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-slate-300">{record.wind_direction_degrees === null ? '—' : `${record.wind_direction_degrees}°`}</td>
                  <td className="px-4 py-2.5 text-slate-300">{formatValue(record.uplift_force_n)}</td>
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

    </div>
  );
}
