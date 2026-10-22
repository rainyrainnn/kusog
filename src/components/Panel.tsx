import type { ReactNode } from 'react';

type PanelProps = {
  title: string;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function Panel({ title, icon, right, children, className = '', bodyClassName = '' }: PanelProps) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-md border border-sky-300/15 bg-base-900/90 shadow-panel backdrop-blur-sm ${className}`}
    >
      <header className="flex min-w-0 items-center justify-between gap-2 border-b border-sky-300/10 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          {icon && <span className="text-accent-600">{icon}</span>}
          <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-slate-200">
            {title}
          </h2>
        </div>
        {right}
      </header>
      <div className={`min-w-0 flex-1 p-3.5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function StatusDot({ color = 'ok', pulse = true }: { color?: 'ok' | 'danger' | 'warn' | 'accent'; pulse?: boolean }) {
  const map = {
    ok: 'bg-ok-500',
    danger: 'bg-danger-500',
    warn: 'bg-warn-500',
    accent: 'bg-accent-500',
  };
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {pulse && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${map[color]} opacity-60`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${map[color]}`} />
    </span>
  );
}
