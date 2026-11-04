import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, icon, right }: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex min-w-0 items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent-400/25 bg-accent-500/10 text-accent-300 shadow-glow-accent">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-bold tracking-tight text-slate-100">{title}</h1>
        <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
