import { useEffect, useState } from 'react';
import { BrainCircuit, CheckCircle2, AlertCircle } from 'lucide-react';
import { Panel, StatusDot } from '../Panel';
import type { Simulation } from '@/hooks/useSimulation';
import { hasDamageClasses, isEdgeConfigured, getDetections, getEdgeHealth, type EdgeDetectionResponse, type EdgeHealth } from '@/lib/edgeService';

export function AiAssessment({ sim }: { sim: Simulation }) {
  const recordYoloAssessment = sim.recordYoloAssessment;
  const [health, setHealth] = useState<EdgeHealth | null>(null);
  const [result, setResult] = useState<EdgeDetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdgeConfigured) {
      setError('Set VITE_KUSOG_EDGE_URL in .env to connect the Raspberry Pi edge service.');
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const [nextHealth, nextResult] = await Promise.all([getEdgeHealth(), getDetections()]);
        if (!cancelled) {
          setHealth(nextHealth);
          setResult(nextResult);
          setError(null);
          const analysisReady = nextHealth.status === 'ok'
            && (nextHealth.modelReady ?? Boolean(nextHealth.model))
            && nextHealth.camera === 'online';
          recordYoloAssessment(nextResult.detections, analysisReady, nextHealth.classes ?? []);
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'YOLO service unavailable.');
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [recordYoloAssessment]);

  const detections = result?.detections ?? [];
  const ready = health?.status === 'ok'
    && (health.modelReady ?? Boolean(health.model))
    && health.camera === 'online';
  const canAssessDamage = hasDamageClasses(health?.classes);
  const model = health?.model || 'YOLO26n';
  const averageConfidence = detections.length
    ? detections.reduce((total, detection) => total + detection.confidence, 0) / detections.length
    : 0;

  return (
    <Panel
      title="YOLO Object Detection"
      icon={<BrainCircuit className="h-4 w-4" />}
      right={<span className="flex items-center gap-1.5"><StatusDot color={ready ? 'ok' : 'warn'} pulse={ready} /><span className={`text-[10px] font-bold tracking-wider ${ready ? 'text-ok-400' : 'text-warn-400'}`}>{ready ? 'RUNNING' : 'WAITING'}</span></span>}
      className="h-full"
    >
      <div className="flex h-full flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-600">Model</p>
            <p className="mt-1 font-mono text-sm font-bold text-slate-300">{model}</p>
          </div>
          <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-600">Status</p>
            <p className={`mt-1 text-sm font-bold ${ready ? 'text-ok-400' : 'text-warn-400'}`}>{ready ? 'READY' : 'WAITING FOR PI'}</p>
          </div>
        </div>

        <div className="flex-1 rounded-lg border border-base-600/70 bg-base-900/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Objects detected</span>
            <span className="font-mono text-[10px] text-slate-600">LIVE RESULTS</span>
          </div>
          <div className="flex h-full min-h-24 items-center justify-center text-center">
            {detections.length > 0 ? (
              <div className="w-full space-y-1.5 text-left">
                {detections.slice(0, 4).map((detection, index) => (
                  <div key={`${detection.className}-${index}`} className="flex items-center justify-between rounded border border-base-600/60 px-2 py-1.5">
                    <span className="text-xs text-slate-300">{detection.className}</span>
                    <span className="font-mono text-[10px] text-ok-400">{(detection.confidence * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            ) : ready ? (
              <div>
                <CheckCircle2 className="mx-auto h-6 w-6 text-ok-400" />
                <p className="mt-2 text-xs text-slate-400">No objects detected.</p>
                <p className="mt-1 text-[10px] text-slate-600">Live results from YOLO26n.</p>
              </div>
            ) : (
              <div>
                <AlertCircle className="mx-auto h-6 w-6 text-warn-400" />
                <p className="mt-2 text-xs text-slate-400">YOLO results unavailable.</p>
                <p className="mt-1 text-[10px] text-slate-600">{error || 'Connect the edge service and camera to populate real detections.'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-base-600/70 bg-base-900/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Confidence</span>
            <span className={`font-mono text-lg font-bold ${ready ? 'text-ok-400' : 'text-slate-500'}`}>{(averageConfidence * 100).toFixed(1)}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-base-700/60">
            <div className="h-full rounded-full bg-gradient-to-r from-ok-600 to-ok-400 transition-all duration-700" style={{ width: `${averageConfidence * 100}%` }} />
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-600">{result?.inferenceTimeMs ?? '—'} ms · {health?.resolution || '—'} · {health?.fps ?? '—'} FPS</p>
          {ready && !canAssessDamage && (
            <p className="mt-2 text-center text-[10px] text-warn-300">
              This model has no damage-related classes. Test result will be Not assessed, not Passed.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
