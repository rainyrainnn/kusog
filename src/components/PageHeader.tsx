import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, icon, right }: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex min-w-0 items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-400/20 bg-white text-accent-600">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        <p className="text-xs text-slate-600">{subtitle}</p>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
