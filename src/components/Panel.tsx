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
      className={`flex flex-col rounded-xl border border-base-600/70 bg-base-800/80 shadow-panel backdrop-blur-sm ${className}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-base-600/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {icon && <span className="text-accent-400">{icon}</span>}
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            {title}
          </h2>
        </div>
        {right}
      </header>
      <div className={`flex-1 p-4 ${bodyClassName}`}>{children}</div>
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
