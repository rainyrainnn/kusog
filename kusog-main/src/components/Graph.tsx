import type { ReactNode } from 'react';

type GraphProps = {
  data: number[];
  color: string;
  yLabel: string;
  xLabel: string;
  yMax?: number;
  yMin?: number;
  fill?: boolean;
  badge?: ReactNode;
};

export function Graph({ data, color, yLabel, xLabel, yMax, yMin = 0, fill = true, badge }: GraphProps) {
  const w = 100;
  const h = 100;
  const n = data.length;
  const max = yMax ?? Math.max(...data, yMin + 1) * 1.15;
  const min = yMin;
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (n - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return [x, y];
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={`fill-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorVar(color)} stopOpacity="0.35" />
            <stop offset="100%" stopColor={colorVar(color)} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1="0" y1={h * t} x2={w} y2={h * t} stroke="#1c2942" strokeWidth="0.3" />
        ))}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={`v${t}`} x1={w * t} y1="0" x2={w * t} y2={h} stroke="#1c2942" strokeWidth="0.3" />
        ))}

        {fill && <path d={areaPath} fill={`url(#fill-${color})`} />}
        <path d={linePath} fill="none" stroke={colorVar(color)} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {/* current point */}
        {points.length > 0 && (
          <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="1.4" fill={colorVar(color)} vectorEffect="non-scaling-stroke">
            <animate attributeName="r" values="1.4;2.4;1.4" dur="1.5s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>

      {/* y-axis labels */}
      <div className="pointer-events-none absolute left-0 top-0 flex h-full flex-col justify-between py-0.5 text-[9px] text-slate-600">
        <span>{max.toFixed(1)}</span>
        <span>{((max + min) / 2).toFixed(1)}</span>
        <span>{min.toFixed(1)}</span>
      </div>

      {/* x-axis label */}
      <div className="pointer-events-none absolute bottom-0.5 right-1 text-[9px] text-slate-600">{xLabel}</div>
      <div className="pointer-events-none absolute left-3 top-0.5 text-[9px] text-slate-600">{yLabel}</div>

      {badge && <div className="absolute right-1 top-1">{badge}</div>}
    </div>
  );
}

function colorVar(c: string): string {
  const map: Record<string, string> = {
    accent: '#38bdf8',
    ok: '#4ade80',
    warn: '#fbbf24',
    danger: '#f87171',
    violet: '#a78bfa',
  };
  return map[c] ?? c;
}
