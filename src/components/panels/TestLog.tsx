import { useState, useMemo } from 'react';
import { ScrollText, ChevronRight, Info, CheckCircle2, AlertTriangle, XCircle, Search, X } from 'lucide-react';
import { Panel } from '../Panel';
import type { Simulation } from '@/hooks/useSimulation';

const LEVEL_ICON = {
  info: { icon: Info, color: 'text-accent-400' },
  ok: { icon: CheckCircle2, color: 'text-ok-400' },
  warn: { icon: AlertTriangle, color: 'text-warn-400' },
  error: { icon: XCircle, color: 'text-danger-400' },
};

export function TestLog({ sim }: { sim: Simulation }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const logs = [...sim.logs].reverse();

  const filtered = useMemo(() => {
    if (!query.trim()) return logs;
    const q = query.toLowerCase();
    return logs.filter((l) => l.message.toLowerCase().includes(q) || l.time.toLowerCase().includes(q));
  }, [logs, query]);

  return (
    <Panel
      title="Test Log (Recent)"
      icon={<ScrollText className="h-4 w-4" />}
      right={<span className="font-mono text-[10px] text-slate-500">{sim.logs.length} entries</span>}
      className="h-full"
      bodyClassName="p-0"
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1.5">
            {logs.slice(0, 12).map((log) => {
              const { icon: Icon, color } = LEVEL_ICON[log.level];
              return (
                <li
                  key={log.id}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs transition hover:bg-base-700/40"
                >
                  <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} />
                  <span className="shrink-0 font-mono text-slate-500">{log.time}</span>
                  <span className="text-slate-300">{log.message}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="border-t border-base-600/60 p-2.5">
          <button
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-base-600/70 bg-base-700/50 py-2 text-xs font-semibold text-slate-300 transition hover:border-accent-500/50 hover:text-accent-400"
          >
            View full log <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-base-600/70 bg-base-800 shadow-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-base-600/60 px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-accent-400">
                <ScrollText className="h-4 w-4" /> Full Test Log
              </h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-base-600/60 p-3">
              <div className="flex items-center gap-2 rounded-lg border border-base-600/70 bg-base-900/60 px-3 py-2">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search log entries..."
                  className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-slate-500 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {filtered.length === 0 ? (
                  <li className="py-8 text-center text-sm text-slate-500">No matching entries</li>
                ) : (
                  filtered.map((log) => {
                    const { icon: Icon, color } = LEVEL_ICON[log.level];
                    return (
                      <li
                        key={log.id}
                        className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs transition hover:bg-base-700/40"
                      >
                        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} />
                        <span className="shrink-0 font-mono text-slate-500">{log.time}</span>
                        <span className="text-slate-300">{log.message}</span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
            <div className="border-t border-base-600/60 px-5 py-2.5 text-[10px] text-slate-600">
              Showing {filtered.length} of {sim.logs.length} entries
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
