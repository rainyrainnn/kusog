import type { Simulation } from '@/hooks/useSimulation';

type Props = {
  sim: Simulation;
  showBoxes?: boolean;
};

export function ChamberScene({ sim, showBoxes = false }: Props) {
  const running = sim.isTestRunning;
  const critical = sim.testResult === 'FAILED';
  const boxColor = !running ? '#475569' : critical ? '#ef4444' : '#22c55e';

  return (
    <div className="w-full" style={{ aspectRatio: '400/240' }}>
      <svg
        viewBox="0 0 400 240"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        className="block"
      >
        <defs>
          <linearGradient id="ch-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#162038" />
            <stop offset="100%" stopColor="#070b14" />
          </linearGradient>
          <linearGradient id="ch-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b4a6b" />
            <stop offset="100%" stopColor="#1c2942" />
          </linearGradient>
          <linearGradient id="ch-house" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="ch-roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
        </defs>

        {/* Chamber walls & floor */}
        <rect x="20" y="20" width="360" height="160" fill="#0a0f1c" stroke="#1c2942" strokeWidth="1" />
        <rect x="20" y="180" width="360" height="40" fill="url(#ch-floor)" />
        <line x1="20" y1="180" x2="380" y2="180" stroke="#243352" strokeWidth="2" />

        {/* Grid lines on floor */}
        {[60, 100, 140, 180, 220, 260, 300, 340].map((x) => (
          <line key={x} x1={x} y1="180" x2={x} y2="220" stroke="#1c2942" strokeWidth="0.5" />
        ))}

        {/* Test platform */}
        <rect x="120" y="150" width="160" height="34" rx="3" fill="url(#ch-metal)" stroke="#38bdf8" strokeOpacity="0.3" />
        <line x1="120" y1="160" x2="280" y2="160" stroke="#38bdf8" strokeOpacity="0.2" />
        <rect x="130" y="184" width="6" height="14" fill="#1c2942" />
        <rect x="264" y="184" width="6" height="14" fill="#1c2942" />
        {/* Platform edge lighting */}
        <line x1="120" y1="150" x2="280" y2="150" stroke="#38bdf8" strokeOpacity={running ? 0.6 : 0.15} strokeWidth="1" />

        {/* House model */}
        <rect x="160" y="108" width="80" height="42" fill="url(#ch-house)" stroke="#475569" strokeWidth="0.8" />
        {/* Door */}
        <rect x="192" y="128" width="14" height="22" fill="#334155" />
        <circle cx="203" cy="139" r="0.8" fill="#94a3b8" />
        {/* Windows */}
        <rect x="168" y="116" width="14" height="10" fill="#0ea5e9" fillOpacity="0.4" stroke="#0ea5e9" strokeOpacity="0.5" />
        <rect x="218" y="116" width="14" height="10" fill="#0ea5e9" fillOpacity="0.4" stroke="#0ea5e9" strokeOpacity="0.5" />
        {/* Window glare */}
        <line x1="168" y1="116" x2="175" y2="121" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />
        <line x1="218" y1="116" x2="225" y2="121" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />
        {/* Roof */}
        <polygon points="155,108 200,84 245,108" fill="url(#ch-roof)" stroke="#7f1d1d" strokeWidth="0.8" />
        <line x1="200" y1="84" x2="200" y2="108" stroke="#7f1d1d" strokeOpacity="0.5" />
        {/* Chimney */}
        <rect x="226" y="89" width="8" height="12" fill="#991b1b" />

        {/* Roof sensor */}
        <rect x="196" y="80" width="8" height="6" rx="1" fill={running ? '#22c55e' : '#475569'} />
        <line x1="200" y1="80" x2="200" y2="74" stroke={running ? '#22c55e' : '#475569'} strokeWidth="1" />
        <circle
          cx="200"
          cy="73"
          r="1.5"
          fill={running ? '#22c55e' : '#475569'}
          className={running ? 'animate-pulse-soft' : ''}
        />

        {/* AI bounding boxes */}
        {showBoxes && (
          <g>
            <rect x="150" y="76" width="100" height="76" fill="none" stroke={boxColor} strokeWidth="1" strokeDasharray="4 3" />
            <text x="152" y="72" fontSize="7" fill={boxColor} fontFamily="monospace">STRUCTURE</text>
            <rect x="155" y="80" width="90" height="30" fill="none" stroke={boxColor} strokeWidth="0.7" strokeDasharray="2 2" opacity="0.6" />
            <text x="157" y="78" fontSize="6" fill={boxColor} fontFamily="monospace" opacity="0.7">ROOF</text>
            {critical && (
              <>
                <rect x="150" y="76" width="100" height="76" fill={boxColor} fillOpacity="0.05" />
                <text x="200" y="166" fontSize="7" fill={boxColor} fontFamily="monospace" textAnchor="middle" fontWeight="bold">⚠ CRITICAL</text>
              </>
            )}
          </g>
        )}

        {/* Sensor nodes on walls */}
        {[[30, 60], [370, 60], [30, 140], [370, 140]].map(([x, y], i) => (
          <circle
            key={`s${i}`}
            cx={x}
            cy={y}
            r="3"
            fill={running ? '#22c55e' : '#1c2942'}
            stroke={running ? '#22c55e' : '#334155'}
            strokeWidth="1"
            className={running ? 'animate-pulse-soft' : ''}
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        ))}
      </svg>
    </div>
  );
}
