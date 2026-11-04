import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { ScrollText, Search, Info, CheckCircle2, AlertTriangle, XCircle, Filter, Download, RefreshCw, ChevronDown, ChevronUp, CalendarDays, RotateCcw, Activity, Clock3 } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import type { Simulation, LogEntry } from '@/hooks/useSimulation';
import {
  fetchTestRecordsWithSensorReadings,
  subscribeToSensorReadingsChanged,
  subscribeToTestRecordsChanged,
  type TestRecordWithSensorSummary,
} from '@/lib/testRecords';
import {
  getScenarioLabel,
  getStructuralDamageLabel,
  getWeatherStatusLabel,
} from '@/lib/testClassification';
import { presentSavedRainReading } from '@/lib/rainLogPresentation';

const LEVEL_ICON = {
  info: { icon: Info, color: 'text-accent-400' },
  ok: { icon: CheckCircle2, color: 'text-ok-400' },
  warn: { icon: AlertTriangle, color: 'text-warn-400' },
  error: { icon: XCircle, color: 'text-danger-400' },
};

const LEVELS = ['all', 'info', 'ok', 'warn', 'error'] as const;
const RECORD_STATUSES = ['ALL', 'RUNNING', 'COMPLETED', 'FAILED'] as const;
type RecordSortKey = 'started' | 'ended' | 'duration' | 'testId';

const formatDateTime = (value: string | null) => {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString();
};
const formatValue = (value: number | string | null | undefined) => value === null || value === undefined ? '--' : String(value);
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const testResult = (record: TestRecordWithSensorSummary) => {
  if (record.status === 'FAILED' || record.ai_overall === 'DAMAGE DETECTED') return 'Failed';
  if (record.status === 'RUNNING') return 'In progress';
  return 'Not assessed';
};
const recordStatus = (status: string) => {
  const normalized = status.toUpperCase();
  return normalized === 'RUNNING' || normalized === 'COMPLETED' || normalized === 'FAILED'
    ? normalized
    : 'UNAVAILABLE';
};
const formatDuration = (seconds: number | null) => {
  if (seconds === null || !Number.isFinite(seconds)) return '--';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
};

export function LogView({ sim }: { sim: Simulation }) {
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<(typeof LEVELS)[number]>('all');
  const [testRecords, setTestRecords] = useState<TestRecordWithSensorSummary[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [recordQuery, setRecordQuery] = useState('');
  const [recordStatusFilter, setRecordStatusFilter] = useState<(typeof RECORD_STATUSES)[number]>('ALL');
  const [startedAfter, setStartedAfter] = useState('');
  const [startedBefore, setStartedBefore] = useState('');
  const [recordSort, setRecordSort] = useState<RecordSortKey>('started');
  const [sortDescending, setSortDescending] = useState(true);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const refreshRecords = useRef<() => void>(() => undefined);

  useEffect(() => {
    let active = true;
    let loading = false;
    let refreshPending = false;
    const load = async () => {
      if (loading) {
        refreshPending = true;
        return;
      }
      loading = true;
      do {
        refreshPending = false;
        try {
          const { data, error } = await fetchTestRecordsWithSensorReadings();
          if (active) {
            setRecordsError(error?.message ?? null);
            if (!error) setTestRecords(data);
            setIsLoadingRecords(false);
          }
        } catch (error) {
          if (active) {
            setRecordsError(error instanceof Error ? error.message : 'Unable to load simulation records.');
            setIsLoadingRecords(false);
          }
        }
      } while (active && refreshPending);
      loading = false;
    };

    refreshRecords.current = () => void load();
    void load();
    const unsubscribeRecords = subscribeToTestRecordsChanged(() => void load());
    const unsubscribeReadings = subscribeToSensorReadingsChanged(() => void load());
    const interval = window.setInterval(() => void load(), 15000);
    return () => {
      active = false;
      refreshRecords.current = () => undefined;
      unsubscribeRecords();
      unsubscribeReadings();
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

  const filteredRecords = useMemo(() => {
    const search = recordQuery.trim().toLowerCase();
    return testRecords
      .filter((record) => recordStatusFilter === 'ALL' || recordStatus(record.status) === recordStatusFilter)
      .filter((record) => !search || [
        record.test_id,
        record.scenario,
        record.status,
        record.test_mode,
      ].some((value) => value?.toLowerCase().includes(search)))
      .filter((record) => {
        if (!startedAfter && !startedBefore) return true;
        if (!record.start_time) return false;
        const startedDate = new Date(record.start_time);
        if (Number.isNaN(startedDate.getTime())) return false;
        const date = `${startedDate.getFullYear()}-${String(startedDate.getMonth() + 1).padStart(2, '0')}-${String(startedDate.getDate()).padStart(2, '0')}`;
        return (!startedAfter || date >= startedAfter) && (!startedBefore || date <= startedBefore);
      })
      .sort((a, b) => {
        let comparison = 0;
        if (recordSort === 'testId') {
          comparison = a.test_id.localeCompare(b.test_id);
        } else if (recordSort === 'duration') {
          comparison = (a.duration_seconds ?? -1) - (b.duration_seconds ?? -1);
        } else {
          const field = recordSort === 'started' ? 'start_time' : 'end_time';
          const aTime = a[field] ? Date.parse(a[field] as string) : -1;
          const bTime = b[field] ? Date.parse(b[field] as string) : -1;
          comparison = aTime - bTime;
        }
        return sortDescending ? -comparison : comparison;
      });
  }, [testRecords, recordQuery, recordStatusFilter, startedAfter, startedBefore, recordSort, sortDescending]);

  const recordSummary = useMemo(() => ({
    total: testRecords.length,
    running: testRecords.filter((record) => recordStatus(record.status) === 'RUNNING').length,
    completed: testRecords.filter((record) => recordStatus(record.status) === 'COMPLETED').length,
    failed: testRecords.filter((record) => recordStatus(record.status) === 'FAILED').length,
  }), [testRecords]);

  const resetRecordFilters = () => {
    setRecordQuery('');
    setRecordStatusFilter('ALL');
    setStartedAfter('');
    setStartedBefore('');
    setRecordSort('started');
    setSortDescending(true);
  };

  const exportCsv = () => {
    const rows: unknown[][] = [['Time', 'Level', 'Message'], ...sim.logs.map((l) => [l.time, l.level, l.message])];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    downloadCsv(csv, 'kusog_test_log.csv');
  };

  const exportTestRecordsCsv = () => {
    const headings = [
      'Test ID',
      'Test mode',
      'Scenario',
      'Actual weather status',
      'Structural damage assessment',
      'Started',
      'Ended',
      'Result',
      'Physical rain level',
      'Physical rain state',
      'Physical rain 24h (API unit)',
      'Physical reading saved at',
      'Physical battery percentage',
      'BMP280 temperature (°C)',
      'BMP280 atmospheric pressure (hPa)',
      'BMP280 reading saved at',
      'Wind speed (km/h)',
      'Wind direction (degrees)',
      'Uplift force (N)',
    ];
    const rows: unknown[][] = [
      headings,
      ...testRecords.map((record) => [
        record.test_id,
        record.test_mode ?? 'Not recorded',
        getScenarioLabel(record.scenario, record.test_mode),
        getWeatherStatusLabel(record.actual_weather_status),
        getStructuralDamageLabel(record.structural_damage_status, record.ai_overall),
        record.start_time,
        record.end_time,
        testResult(record),
        record.rain_reading_level,
        record.rain_reading_state,
        record.rain_reading_24h,
        record.rain_reading_recorded_at,
        record.rain_reading_battery_percentage,
        record.bmp280_temperature_c,
        record.bmp280_pressure_hpa,
        record.bmp280_reading_recorded_at,
        record.wind_speed_kmh,
        record.wind_direction_degrees,
        record.uplift_force_n,
      ]),
    ];
    downloadCsv(rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'kusog_simulation_records.csv');
  };

  const downloadCsv = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Test Log & Records" subtitle="Operator-scoped simulation history, saved sensor readings, and system events." icon={<ScrollText className="h-5 w-5" />} />

      <section aria-label="Test record summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard label="Total records" value={isLoadingRecords && testRecords.length === 0 ? '--' : recordSummary.total} icon={<ScrollText className="h-4 w-4" />} tone="text-accent-300" />
        <SummaryCard label="Completed" value={isLoadingRecords && testRecords.length === 0 ? '--' : recordSummary.completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="text-ok-300" />
        <SummaryCard label="Failed" value={isLoadingRecords && testRecords.length === 0 ? '--' : recordSummary.failed} icon={<XCircle className="h-4 w-4" />} tone="text-danger-300" />
        <SummaryCard label="Running" value={isLoadingRecords && testRecords.length === 0 ? '--' : recordSummary.running} icon={<Activity className="h-4 w-4" />} tone={recordSummary.running ? 'text-warn-300' : 'text-slate-400'} />
      </section>

      <Panel
        title={`Saved Test Records (${filteredRecords.length}${testRecords.length !== filteredRecords.length ? ` of ${testRecords.length}` : ''})`}
        icon={<Clock3 className="h-4 w-4" />}
        bodyClassName="p-0"
      >
        <div className="space-y-3 border-b border-base-600/60 p-3 sm:p-4">
          <p className="text-[11px] leading-relaxed text-slate-400">
            Active sessions are identified separately from completed history. Sensor columns show the latest associated saved readings; missing values are shown as --.
          </p>
          {recordsError && (
            <p role="alert" className="rounded-lg border border-danger-400/20 bg-danger-400/[0.05] px-3 py-2 text-xs text-danger-300">
              Unable to refresh test history: {recordsError}
            </p>
          )}
          <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-base-600/70 bg-base-950/50 px-3 py-2 md:col-span-2 xl:col-span-2">
              <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                value={recordQuery}
                onChange={(event) => setRecordQuery(event.target.value)}
                placeholder="Search Test ID, scenario, status, or mode"
                aria-label="Search test history"
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
              />
            </label>
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-base-600/70 bg-base-950/50 px-3 py-2">
              <Filter className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span className="text-[10px] text-slate-500">Status</span>
              <select
                value={recordStatusFilter}
                onChange={(event) => setRecordStatusFilter(event.target.value as (typeof RECORD_STATUSES)[number])}
                aria-label="Filter records by status"
                className="min-w-0 bg-transparent text-xs text-slate-200 outline-none"
              >
                {RECORD_STATUSES.map((status) => <option key={status} value={status}>{status === 'ALL' ? 'All statuses' : status}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-base-600/70 bg-base-950/50 px-3 py-2">
              <span className="text-[10px] text-slate-500">Sort</span>
              <select
                value={recordSort}
                onChange={(event) => setRecordSort(event.target.value as RecordSortKey)}
                aria-label="Sort test history"
                className="min-w-0 bg-transparent text-xs text-slate-200 outline-none"
              >
                <option value="started">Started</option>
                <option value="ended">Ended</option>
                <option value="duration">Duration</option>
                <option value="testId">Test ID</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDescending((descending) => !descending)}
                aria-label={sortDescending ? 'Sort ascending' : 'Sort descending'}
                title={sortDescending ? 'Descending' : 'Ascending'}
                className="rounded p-1 text-slate-400 hover:text-accent-300"
              >
                {sortDescending ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </button>
            </label>
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-base-600/70 bg-base-950/50 px-3 py-2">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="shrink-0 text-[10px] text-slate-500">From</span>
              <input
                type="date"
                value={startedAfter}
                max={startedBefore || undefined}
                onChange={(event) => setStartedAfter(event.target.value)}
                aria-label="Filter tests started on or after"
                className="min-w-0 w-full bg-transparent text-xs text-slate-200 outline-none [color-scheme:dark]"
              />
            </label>
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-base-600/70 bg-base-950/50 px-3 py-2">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="shrink-0 text-[10px] text-slate-500">To</span>
              <input
                type="date"
                value={startedBefore}
                min={startedAfter || undefined}
                onChange={(event) => setStartedBefore(event.target.value)}
                aria-label="Filter tests started on or before"
                className="min-w-0 w-full bg-transparent text-xs text-slate-200 outline-none [color-scheme:dark]"
              />
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-6">
              <button
                type="button"
                onClick={resetRecordFilters}
                disabled={!recordQuery && recordStatusFilter === 'ALL' && !startedAfter && !startedBefore && recordSort === 'started' && sortDescending}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-base-600 bg-base-800 px-3 text-[10px] font-semibold text-slate-300 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset filters
              </button>
              <button
                type="button"
                onClick={() => refreshRecords.current()}
                disabled={isLoadingRecords}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-base-600 bg-base-800 px-3 text-[10px] font-semibold text-slate-300 hover:text-accent-300 disabled:opacity-50 sm:flex-none"
                title="Refresh test records"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingRecords ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={exportTestRecordsCsv}
                disabled={isLoadingRecords || testRecords.length === 0}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-ok-500/40 bg-ok-500/10 px-3 text-[10px] font-semibold text-ok-400 hover:bg-ok-500/20 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                title="Export simulation records and their latest saved sensor readings"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
          </div>
        </div>

        {isLoadingRecords && testRecords.length === 0 ? (
          <div className="px-4 py-12 text-center text-xs text-slate-400" role="status">Loading test records and associated sensor readings…</div>
        ) : testRecords.length === 0 && recordsError ? (
          <div className="px-4 py-12 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-danger-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-300">Test history unavailable</p>
            <p className="mt-1 text-xs text-slate-500">The saved records could not be loaded. Use Refresh to try again.</p>
          </div>
        ) : testRecords.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ScrollText className="mx-auto h-6 w-6 text-slate-600" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-300">No test history yet</p>
            <p className="mt-1 text-xs text-slate-500">Saved test records will appear here.</p>
          </div>
        ) : filteredRecords.length === 0 && !recordsError ? (
          <div className="px-4 py-12 text-center">
            <Filter className="mx-auto h-6 w-6 text-slate-600" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-300">No matching test records</p>
            <p className="mt-1 text-xs text-slate-500">Adjust or reset search, status, and start-date filters.</p>
          </div>
        ) : (
          <>
            <div className="hidden max-h-[65vh] overflow-auto md:block">
              <table className="w-full min-w-[1120px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-base-800">
                  <tr className="border-b border-base-600/60 text-[9px] uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-3 py-3 font-semibold">Test ID</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Started</th>
                    <th className="px-3 py-3 font-semibold">Ended</th>
                    <th className="px-3 py-3 font-semibold">Duration</th>
                    <th className="px-3 py-3 font-semibold">Result</th>
                    <th className="px-3 py-3 text-right font-semibold">Wind speed (km/h)</th>
                    <th className="px-3 py-3 font-semibold">Wind direction</th>
                    <th className="px-3 py-3 text-right font-semibold">Uplift force (N)</th>
                    <th className="px-3 py-3 text-right font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const expanded = expandedRecordId === record.id;
                    return (
                      <RecordRows
                        key={record.id}
                        record={record}
                        expanded={expanded}
                        onToggle={() => setExpandedRecordId(expanded ? null : record.id)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 md:hidden">
              {filteredRecords.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  expanded={expandedRecordId === record.id}
                  onToggle={() => setExpandedRecordId(expandedRecordId === record.id ? null : record.id)}
                />
              ))}
            </div>
          </>
        )}
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

function statusStyle(status: string) {
  switch (recordStatus(status)) {
    case 'RUNNING': return 'border-ok-400/20 bg-ok-400/[0.08] text-ok-300';
    case 'COMPLETED': return 'border-sky-300/20 bg-sky-300/[0.06] text-sky-200';
    case 'FAILED': return 'border-danger-400/20 bg-danger-400/[0.08] text-danger-300';
    default: return 'border-slate-400/15 bg-slate-400/[0.05] text-slate-400';
  }
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

function resultStyle(result: string) {
  if (result === 'Failed') return 'text-danger-300';
  if (result === 'Passed') return 'text-ok-300';
  return 'text-slate-300';
}

function RecordRows({ record, expanded, onToggle }: {
  record: TestRecordWithSensorSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const rain = presentSavedRainReading(record);
  const result = testResult(record);
  return (
    <>
      <tr className="border-b border-base-700/50 transition-colors hover:bg-white/[0.025]">
        <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] font-semibold text-slate-200">{record.test_id || '--'}</td>
        <td className="px-3 py-3">
          <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-bold tracking-wider ${statusStyle(record.status)}`}>
            {recordStatus(record.status)}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-slate-300">{formatDateTime(record.start_time)}</td>
        <td className="whitespace-nowrap px-3 py-3 text-slate-300">{formatDateTime(record.end_time)}</td>
        <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-300">{formatDuration(record.duration_seconds)}</td>
        <td className={`px-3 py-3 font-semibold ${resultStyle(result)}`}>{result}</td>
        <td className="px-3 py-3 text-right font-mono text-slate-300">{record.wind_speed_kmh === null ? '--' : record.wind_speed_kmh.toFixed(1)}</td>
        <td className="px-3 py-3 font-mono text-slate-300">{record.wind_direction_degrees === null ? '--' : `${record.wind_direction_degrees.toFixed(1)}°`}</td>
        <td className="px-3 py-3 text-right font-mono text-slate-300">{record.uplift_force_n === null ? '--' : record.uplift_force_n.toFixed(2)}</td>
        <td className="px-3 py-3 text-right">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Inspect'} test ${record.test_id}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-accent-300 hover:bg-accent-300/10"
          >
            {expanded ? 'Hide' : 'Inspect'}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-base-700/50 bg-base-950/35">
          <td colSpan={10} className="px-4 py-4">
            <RecordDetails record={record} rain={rain} />
          </td>
        </tr>
      )}
    </>
  );
}

function RecordCard({ record, expanded, onToggle }: {
  record: TestRecordWithSensorSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const rain = presentSavedRainReading(record);
  const result = testResult(record);
  return (
    <article className="rounded-xl border border-sky-200/10 bg-base-900/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-all font-mono text-[11px] font-semibold text-slate-200">{record.test_id || '--'}</p>
          <p className="mt-1 text-[10px] text-slate-500">Started {formatDateTime(record.start_time)}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold tracking-wider ${statusStyle(record.status)}`}>
          {recordStatus(record.status)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-sky-200/10 pt-3">
        <DetailValue label="Ended" value={formatDateTime(record.end_time)} />
        <DetailValue label="Duration" value={formatDuration(record.duration_seconds)} />
        <DetailValue label="Result" value={result} valueClass={resultStyle(result)} />
        <DetailValue label="Wind speed" value={record.wind_speed_kmh === null ? '--' : `${record.wind_speed_kmh.toFixed(1)} km/h`} />
        <DetailValue label="Wind direction" value={record.wind_direction_degrees === null ? '--' : `${record.wind_direction_degrees.toFixed(1)}°`} />
        <DetailValue label="Uplift force" value={record.uplift_force_n === null ? '--' : `${record.uplift_force_n.toFixed(2)} N`} />
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-accent-300"
      >
        {expanded ? 'Hide record details' : 'Inspect record'}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded && <div className="mt-3 border-t border-sky-200/10 pt-3"><RecordDetails record={record} rain={rain} /></div>}
    </article>
  );
}

function RecordDetails({ record, rain }: {
  record: TestRecordWithSensorSummary;
  rain: ReturnType<typeof presentSavedRainReading>;
}) {
  return (
    <div>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Saved record details</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        <DetailValue label="Scenario" value={getScenarioLabel(record.scenario, record.test_mode)} />
        <DetailValue label="Test mode" value={record.test_mode ?? '--'} />
        <DetailValue label="Actual weather" value={getWeatherStatusLabel(record.actual_weather_status)} />
        <DetailValue label="Structural assessment" value={getStructuralDamageLabel(record.structural_damage_status, record.ai_overall)} />
        <DetailValue label="BMP280 temperature" value={record.bmp280_temperature_c === null ? '--' : `${record.bmp280_temperature_c.toFixed(1)} °C`} />
        <DetailValue label="BMP280 atmospheric pressure" value={record.bmp280_pressure_hpa === null ? '--' : `${record.bmp280_pressure_hpa.toFixed(1)} hPa`} />
        <DetailValue label="BMP280 reading recorded at" value={formatDateTime(record.bmp280_reading_recorded_at)} />
        <DetailValue label="Saved rain level" value={rain.level} />
        <DetailValue label="Saved rain state" value={rain.state} />
        <DetailValue label="Saved rainfall (API unit)" value={formatValue(rain.rain24h)} />
        <DetailValue label="Rain reading recorded at" value={formatDateTime(rain.recordedAt)} />
        <DetailValue label="Rain reading source" value={rain.status} />
        <DetailValue label="Rain battery" value={rain.battery === null ? '--' : `${rain.battery}%`} />
      </div>
    </div>
  );
}

function DetailValue({ label, value, valueClass = 'text-slate-200' }: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 break-words text-[11px] font-medium ${valueClass}`}>{value}</p>
    </div>
  );
}
