import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, icon, right }: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-lg border border-accent-500/30 bg-accent-500/10 text-accent-400 shadow-glow-accent">
        {icon}
      </span>
      <div className="flex-1">
        <h1 className="text-lg font-bold tracking-wide text-white">{title}</h1>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}
