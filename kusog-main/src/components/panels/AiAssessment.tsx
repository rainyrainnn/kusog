import { AlertTriangle, BrainCircuit, Camera, Crosshair, Cpu, Network } from 'lucide-react';
import { Panel, StatusDot } from '../Panel';
import type { YoloDetectionState } from '@/hooks/useYoloDetections';

type AiAssessmentProps = {
  isSimulationActive: boolean;
  yolo: YoloDetectionState;
};

export function AiAssessment({ isSimulationActive, yolo }: AiAssessmentProps) {
  const { health, result } = yolo;
  const serviceReady = isSimulationActive && health?.status === 'ok';
  const modelReady = serviceReady && (health.modelReady ?? Boolean(health.model));
  const cameraOnline = serviceReady && health.camera === 'online';
  const monitoringReady = Boolean(modelReady && cameraOnline);
  const detections = monitoringReady && result ? result.detections : null;
  const latestDetection = detections?.[detections.length - 1] ?? null;
  const modelStatus = !isSimulationActive
    ? 'IDLE'
    : modelReady ? 'READY' : yolo.loading ? 'CONNECTING' : 'UNAVAILABLE';
  const serviceStatus = !isSimulationActive
    ? 'IDLE'
    : serviceReady ? 'CONNECTED' : yolo.loading ? 'CONNECTING' : 'UNAVAILABLE';
  const cameraStatus = !isSimulationActive
    ? 'IDLE'
    : health?.status === 'ok' && health.camera === 'online' ? 'ONLINE'
      : health?.status === 'ok' && health.camera === 'offline' ? 'OFFLINE'
        : yolo.loading ? 'CONNECTING' : 'UNAVAILABLE';

  return (
    <Panel
      title="AI Monitoring"
      icon={<BrainCircuit className="h-4 w-4" />}
      right={<StatusBadge label={monitoringReady ? 'MONITORING' : isSimulationActive ? 'NOT READY' : 'IDLE'} tone={monitoringReady ? 'ok' : 'neutral'} pulse={monitoringReady} />}
      className="h-full"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <StatusCard icon={<Network className="h-4 w-4" />} label="Edge service" value={serviceStatus} tone={serviceReady ? 'ok' : 'muted'} />
          <StatusCard icon={<Cpu className="h-4 w-4" />} label="Model" value={modelStatus} detail={isSimulationActive ? health?.model || '--' : '--'} tone={modelReady ? 'ok' : 'muted'} />
          <StatusCard icon={<Camera className="h-4 w-4" />} label="Camera" value={cameraStatus} detail={cameraOnline ? health?.resolution || '--' : undefined} tone={cameraOnline ? 'ok' : health?.camera === 'offline' ? 'danger' : 'muted'} />
        </div>

        <section className="rounded-xl border border-base-600/70 bg-base-900/50 p-3 sm:p-4" aria-labelledby="ai-object-detections">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="ai-object-detections" className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Crosshair className="h-4 w-4 text-accent-300" aria-hidden="true" />
              Object detections
            </h3>
            <span className="rounded-full border border-sky-200/10 bg-base-950/60 px-2.5 py-1 font-mono text-xs text-slate-300">
              Count: {detections === null ? '--' : detections.length}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {detections === null ? (
              <p className="rounded-lg border border-base-600/60 px-3 py-4 text-center text-xs text-slate-500">
                {!isSimulationActive
                  ? 'Start a simulation to enable AI monitoring.'
                  : yolo.loading
                    ? 'Connecting to the edge service and camera.'
                    : yolo.error || 'Detection results unavailable.'}
              </p>
            ) : detections.length === 0 ? (
              <p className="rounded-lg border border-base-600/60 px-3 py-4 text-center text-xs text-slate-400">
                No objects detected in the latest result.
              </p>
            ) : (
              detections.map((detection, index) => (
                <div key={`${detection.className}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-base-600/60 bg-base-950/40 px-3 py-2">
                  <span className="min-w-0 truncate text-sm font-medium text-slate-200" title={detection.className}>
                    {detection.className}
                  </span>
                  <span className="shrink-0 rounded-md bg-ok-500/10 px-2 py-1 font-mono text-xs font-semibold text-ok-300">
                    {(detection.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 border-t border-sky-200/10 pt-3 sm:grid-cols-2">
            <Metric label="Latest detection" value={latestDetection?.className ?? (detections?.length === 0 ? 'None' : '--')} />
            <Metric label="Inference time" value={monitoringReady && result ? `${result.inferenceTimeMs} ms` : '--'} />
          </div>
        </section>

        <section className="rounded-xl border border-warn-400/20 bg-warn-400/[0.04] p-3 sm:p-4" aria-labelledby="ai-structural-assessment">
          <h3 id="ai-structural-assessment" className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <AlertTriangle className="h-4 w-4 text-warn-300" aria-hidden="true" />
            Structural damage assessment
          </h3>
          <p className="mt-2 text-xs font-bold tracking-[0.12em] text-warn-300">NOT ASSESSED</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            The edge service provides object detections, not a separately verified structural damage assessment.
          </p>
        </section>
      </div>
    </Panel>
  );
}

function StatusCard({ icon, label, value, detail, tone }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone: 'ok' | 'danger' | 'muted';
}) {
  const toneClass = tone === 'ok' ? 'text-ok-300' : tone === 'danger' ? 'text-danger-300' : 'text-slate-400';
  return (
    <div className="min-w-0 rounded-lg border border-base-600/70 bg-base-900/50 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span className={toneClass}>{icon}</span>
        {label}
      </p>
      <p className={`mt-2 truncate text-xs font-bold tracking-wide ${toneClass}`}>{value}</p>
      {detail !== undefined && <p className="mt-1 truncate font-mono text-[10px] text-slate-500" title={detail}>{detail}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-slate-200" title={value}>{value}</p>
    </div>
  );
}

function StatusBadge({ label, tone, pulse = false }: { label: string; tone: 'ok' | 'neutral'; pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-sky-200/10 bg-base-950/50 px-2.5 py-1">
      <StatusDot color={tone === 'ok' ? 'ok' : 'warn'} pulse={pulse} />
      <span className={`text-[9px] font-bold tracking-[0.12em] ${tone === 'ok' ? 'text-ok-300' : 'text-slate-400'}`}>{label}</span>
    </span>
  );
}
