import { useEffect, useState } from 'react';
import { BrainCircuit, ScanEye, Crosshair, Activity, Target, Ruler, AlertTriangle, CheckCircle2, Cpu } from 'lucide-react';
import { Panel, StatusDot } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import type { Simulation } from '@/hooks/useSimulation';
import { CAMERA_STREAM_URL, hasDamageClasses, isCameraConfigured, isEdgeConfigured, getDetections, getEdgeHealth, type EdgeDetection, type EdgeDetectionResponse, type EdgeHealth } from '@/lib/edgeService';

export function AiView({ sim }: { sim: Simulation }) {
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
          recordYoloAssessment(nextResult.detections, nextHealth.status === 'ok', nextHealth.classes ?? []);
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
  const connected = health?.status === 'ok';
  const canAssessDamage = hasDamageClasses(health?.classes);
  const maximumConfidence = detections.length ? Math.max(...detections.map((detection) => detection.confidence)) : 0;
  const averageConfidence = detections.length
    ? detections.reduce((total, detection) => total + detection.confidence, 0) / detections.length
    : 0;
  const analysisLog = connected
    ? [
        { time: 'LIVE', msg: `YOLO26n inference: ${detections.length} object(s) detected`, level: 'info' },
        { time: 'LIVE', msg: `Inference time: ${result?.inferenceTimeMs ?? '—'} ms`, level: 'ok' },
        { time: 'LIVE', msg: `Camera: ${health?.resolution || '—'} · ${health?.fps ?? '—'} FPS`, level: 'ok' },
      ]
    : [{ time: '--:--', msg: error || 'Waiting for the Windows YOLO26n service.', level: 'warn' }];

  return (
    <div className="space-y-4">
      <PageHeader title="AI Structural Assessment" subtitle="YOLO26n real-time Raspberry Pi camera analysis" icon={<BrainCircuit className="h-5 w-5" />} />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-7">
          <Panel
            title="AI Processed Feed"
            icon={<ScanEye className="h-4 w-4" />}
            right={
              <span className="flex items-center gap-1.5 rounded-full bg-ok-500/10 px-2 py-0.5">
                <StatusDot color={connected ? 'ok' : 'warn'} pulse={connected} />
                <span className={`text-[10px] font-bold tracking-wider ${connected ? 'text-ok-400' : 'text-warn-400'}`}>
                  {connected ? 'ANALYZING' : 'WAITING'}
                </span>
              </span>
            }
            bodyClassName="p-0"
          >
            <div className="relative h-[340px] overflow-hidden rounded-b-xl bg-gradient-to-b from-slate-900 to-base-900">
              <div className="absolute inset-0 bg-grid opacity-40" />
              {sim.isTestRunning && <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 animate-scan bg-gradient-to-b from-ok-400/10 to-transparent" />}
              {isCameraConfigured ? (
                <img src={CAMERA_STREAM_URL} alt="Raspberry Pi camera used for YOLO26n analysis" className="absolute inset-0 h-full w-full object-contain" />
              ) : (
                <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-slate-400">Set VITE_KUSOG_CAMERA_URL in .env to display the chamber camera.</div>
              )}
              {result && result.width > 0 && result.height > 0 && result.detections.map((detection, index) => (
                <DetectionBox key={`${detection.className}-${index}`} detection={detection} width={result.width} height={result.height} />
              ))}
              <div className="absolute left-3 top-3 z-20 font-mono text-[10px] text-ok-400/80">YOLO26n · {health?.fps ?? '—'} FPS</div>
              <div className="absolute right-3 top-3 z-20 font-mono text-[10px] text-slate-400/80">CONF: {(maximumConfidence * 100).toFixed(1)}%</div>
            </div>
          </Panel>
        </div>

        <div className="col-span-12 space-y-4 xl:col-span-5">
          <Panel title="Key Detections" icon={<Crosshair className="h-4 w-4" />}>
            <div className="space-y-2">
              {detections.length === 0 ? (
                <div className="rounded-lg border border-base-600/70 bg-base-900/50 px-3 py-5 text-center text-xs text-slate-500">
                  {connected ? 'No objects detected.' : 'YOLO detections unavailable.'}
                </div>
              ) : detections.map((detection, index) => (
                <div key={`${detection.className}-${index}`} className="flex items-center justify-between rounded-lg border border-base-600/70 bg-base-900/50 px-3 py-2.5">
                  <span className="text-sm text-slate-300">{detection.className}</span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ok-400">
                    <CheckCircle2 className="h-4 w-4" /> {(detection.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Model Confidence" icon={<Cpu className="h-4 w-4" />}>
            <div className="text-center">
              <p className={`font-mono text-4xl font-bold ${connected ? 'text-ok-400' : 'text-slate-500'}`}>{(averageConfidence * 100).toFixed(1)}%</p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-base-700/60">
                <div className="h-full rounded-full bg-gradient-to-r from-ok-600 to-ok-400 transition-all duration-700" style={{ width: `${averageConfidence * 100}%` }} />
              </div>
              <p className="mt-2 text-[10px] text-slate-500">Model: {health?.model || 'YOLO26n'} · {health?.resolution || '—'}</p>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel title="Detection Summary" icon={<Ruler className="h-4 w-4" />}>
          <div className="text-center">
            <p className="font-mono text-3xl font-bold text-accent-400">{detections.length}</p>
            <p className="mt-1 text-xs text-slate-400">Objects detected</p>
            <p className="mt-2 text-xs text-slate-500">Live results from the Pi camera</p>
            {connected && !canAssessDamage && (
              <p className="mt-2 text-xs text-warn-300">This model has no damage-related classes. Test result will be Not assessed, not Passed.</p>
            )}
          </div>
        </Panel>

        <Panel title="Camera Status" icon={<AlertTriangle className="h-4 w-4" />}>
          <div className="text-center">
            <p className={`font-mono text-3xl font-bold ${health?.camera === 'online' ? 'text-ok-400' : 'text-warn-400'}`}>{health?.camera === 'online' ? 'ONLINE' : 'WAITING'}</p>
            <p className="mt-1 text-xs text-slate-400">{health?.resolution || 'Resolution unavailable'}</p>
            <p className="mt-2 text-xs text-slate-500">Raspberry Pi stream</p>
          </div>
        </Panel>

        <Panel title="Inference Performance" icon={<Activity className="h-4 w-4" />}>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Inference</span><span className="font-mono text-slate-200">{result?.inferenceTimeMs ?? '—'} ms</span></div>
            <div className="flex justify-between"><span className="text-slate-400">FPS</span><span className="font-mono text-slate-200">{health?.fps ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Objects</span><span className="font-mono text-slate-200">{detections.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Model</span><span className="font-mono text-slate-200">{health?.model || 'YOLO26n'}</span></div>
          </div>
        </Panel>
      </div>

      <Panel title="Analysis Log" icon={<Target className="h-4 w-4" />}>
        <div className="max-h-48 overflow-y-auto">
          <ul className="space-y-1">
            {analysisLog.map((entry, index) => (
              <li key={index} className="flex items-start gap-2 px-2 py-1 text-xs">
                <span className="font-mono text-slate-500">{entry.time}</span>
                <span className={entry.level === 'ok' ? 'text-ok-400' : entry.level === 'warn' ? 'text-warn-400' : 'text-slate-300'}>{entry.msg}</span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </div>
  );
}

function DetectionBox({ detection, width, height }: { detection: EdgeDetection; width: number; height: number }) {
  const left = `${(detection.x1 / width) * 100}%`;
  const top = `${(detection.y1 / height) * 100}%`;
  const boxWidth = `${((detection.x2 - detection.x1) / width) * 100}%`;
  const boxHeight = `${((detection.y2 - detection.y1) / height) * 100}%`;

  return (
    <div className="pointer-events-none absolute z-10 border-2 border-ok-400" style={{ left, top, width: boxWidth, height: boxHeight }}>
      <span className="absolute -top-5 left-0 whitespace-nowrap bg-ok-500/80 px-1 font-mono text-[10px] text-white">
        {detection.className} {(detection.confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
}
