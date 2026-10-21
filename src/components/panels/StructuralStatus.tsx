import { ShieldCheck, BrainCircuit, Loader2 } from 'lucide-react';
import { Panel } from '../Panel';
import { useSystemStatus } from '@/hooks/useSystemStatus';

export function StructuralStatus() {
  const system = useSystemStatus();
  const yoloReady = system.yolo === 'online';
  const color = yoloReady ? 'ok' : 'slate';
  const c = color === 'ok'
    ? { text: 'text-ok-400', border: 'border-ok-500/40', bg: 'bg-ok-500/10', bar: 'from-ok-600 to-ok-400' }
    : { text: 'text-slate-400', border: 'border-slate-500/40', bg: 'bg-slate-500/10', bar: 'from-slate-600 to-slate-400' };

  return (
    <Panel title="Structural Status (AI)" icon={<BrainCircuit className="h-4 w-4" />} right={<span className="font-mono text-[10px] text-slate-500">YOLO · EDGE</span>} className="h-full">
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className={`grid h-20 w-20 place-items-center rounded-full border-2 ${c.border} ${c.bg}`}>
          {yoloReady ? <ShieldCheck className={`h-9 w-9 ${c.text}`} /> : <Loader2 className={`h-9 w-9 ${c.text} animate-spin`} />}
        </div>
        <div className="text-center">
          <p className={`text-3xl font-extrabold tracking-wide ${c.text}`}>{yoloReady ? 'READY' : 'WAITING'}</p>
          <p className="mt-1 text-xs text-slate-400">{yoloReady ? 'YOLO edge service is reachable.' : 'Waiting for Raspberry Pi YOLO service.'}</p>
        </div>
        <div className="w-full rounded-lg border border-base-600/70 bg-base-900/50 p-3">
          <div className="flex items-center justify-between text-xs"><span className="text-slate-400">AI confidence</span><span className="font-mono font-bold text-slate-500">—</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-base-700/60"><div className={`h-full w-0 rounded-full bg-gradient-to-r ${c.bar}`} /></div>
          <p className="mt-2 text-center text-[10px] text-slate-500">Confidence is populated from actual YOLO detections.</p>
        </div>
      </div>
    </Panel>
  );
}
