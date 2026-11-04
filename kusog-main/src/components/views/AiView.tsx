import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, BrainCircuit, Camera, Clock3, Crosshair, Cpu, Network, ScanEye, ShieldAlert } from 'lucide-react';
import { Panel, StatusDot } from '@/components/Panel';
import { PageHeader } from '@/components/PageHeader';
import type { Simulation } from '@/hooks/useSimulation';
import { useYoloDetections } from '@/hooks/useYoloDetections';
import { CAMERA_STREAM_URL, hasDamageClasses, isCameraConfigured, isEdgeConfigured, type EdgeDetectionResponse, type EdgeHealth } from '@/lib/edgeService';
import { fetchTestRecords, subscribeToTestRecordsChanged, type TestRecord } from '@/lib/testRecords';

export function AiView({ sim }: { sim: Simulation }) {
  const [testRecords, setTestRecords] = useState<TestRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [cameraStreamStatus, setCameraStreamStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const recordYoloAssessment = sim.recordYoloAssessment;
  const isSimulationActive = sim.isDevicesActive && !sim.isFinalizing;
  const handleYoloResult = useCallback((health: EdgeHealth, result: EdgeDetectionResponse) => {
    const analysisReady = health.status === 'ok'
      && (health.modelReady ?? Boolean(health.model))
      && health.camera === 'online';
    recordYoloAssessment(result.detections, analysisReady, health.classes ?? []);
  }, [recordYoloAssessment]);
  const yolo = useYoloDetections(isSimulationActive, handleYoloResult);
  const { health, result, error } = yolo;

  useEffect(() => {
    setCameraStreamStatus('connecting');
  }, [isSimulationActive]);

  useEffect(() => {
    if (!isSimulationActive) {
      setCameraStreamStatus('connecting');
      return;
    }
    if (!isCameraConfigured || cameraStreamStatus !== 'connecting') return;
    const timeout = window.setTimeout(() => setCameraStreamStatus('offline'), 8000);
    return () => window.clearTimeout(timeout);
  }, [isSimulationActive, cameraStreamStatus]);

  useEffect(() => {
    let active = true;
    let loading = false;
    let refreshPending = false;

    const loadRecords = async () => {
      if (loading) {
        refreshPending = true;
        return;
      }
      loading = true;
      do {
        refreshPending = false;
        try {
          const response = await fetchTestRecords();
          if (active) {
            setRecordsError(response.error?.message ?? null);
            if (!response.error) setTestRecords(response.data);
            setRecordsLoading(false);
          }
        } catch (loadError) {
          if (active) {
            setRecordsError(loadError instanceof Error ? loadError.message : 'Unable to load saved assessment records.');
            setRecordsLoading(false);
          }
        }
      } while (active && refreshPending);
      loading = false;
    };

    void loadRecords();
    const unsubscribe = subscribeToTestRecordsChanged(() => void loadRecords());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const serviceConnected = isSimulationActive && health?.status === 'ok';
  const modelReady = Boolean(serviceConnected && (health?.modelReady ?? Boolean(health?.model)));
  const edgeCameraOnline = Boolean(serviceConnected && health?.camera === 'online');
  const cameraOnline = Boolean(edgeCameraOnline && cameraStreamStatus === 'online');
  const monitoringReady = modelReady && cameraOnline;
  const detections = monitoringReady && result ? result.detections : null;
  const latestDetection = detections?.[detections.length - 1] ?? null;
  const detectionCount = detections === null ? '--' : String(detections.length);
  const damageAssessmentSupported = hasDamageClasses(health?.classes);
  const recordedAssessment = sim.aiDetections.overall;
  const assessmentAvailable = isSimulationActive
    && monitoringReady
    && result !== null
    && damageAssessmentSupported
    && recordedAssessment === 'DAMAGE DETECTED';
  const structuralAssessment = assessmentAvailable ? recordedAssessment : 'NOT ASSESSED';
  const modelStatus = !isSimulationActive
    ? 'IDLE'
    : modelReady ? 'READY' : yolo.loading ? 'CONNECTING' : 'UNAVAILABLE';
  const serviceStatus = !isSimulationActive
    ? 'IDLE'
    : serviceConnected ? 'CONNECTED' : yolo.loading ? 'CONNECTING' : 'UNAVAILABLE';
  const cameraStatus = !isSimulationActive
    ? 'IDLE'
    : edgeCameraOnline && cameraStreamStatus === 'online' ? 'ONLINE'
    : cameraStreamStatus === 'offline' || health?.status === 'ok' && health.camera === 'offline' ? 'OFFLINE'
    : edgeCameraOnline ? 'CONNECTING'
      : yolo.loading ? 'CONNECTING' : 'UNAVAILABLE';
  const monitoringStatus = !isSimulationActive
    ? 'IDLE'
    : monitoringReady ? 'MONITORING'
      : yolo.loading ? 'CONNECTING'
        : 'UNAVAILABLE';
  const detectionStatus = !isSimulationActive
    ? 'IDLE'
    : !monitoringReady
      ? yolo.loading ? 'CONNECTING' : 'UNAVAILABLE'
      : detections?.length ? 'OBJECTS DETECTED' : 'NO OBJECTS DETECTED';
  const assessmentHistory = testRecords
    .filter((record) => record.status !== 'RUNNING'
      && record.ai_overall === 'DAMAGE DETECTED'
      && Boolean(record.ai_cracks)
      && record.ai_cracks !== 'NONE')
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Monitoring & Assessment"
        subtitle="Live edge-model object detection, service health, and verified assessment status."
        icon={<BrainCircuit className="h-5 w-5" />}
      />

      <section className="rounded-xl border border-base-600/70 bg-base-900/70 p-4 shadow-lg shadow-black/10 sm:p-5" aria-label="AI system overview">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">AI system status</p>
            <h2 className="mt-1 text-base font-semibold text-slate-100 sm:text-lg">
              {monitoringReady ? 'Monitoring services available' : !isSimulationActive ? 'Monitoring idle' : yolo.loading ? 'Connecting to monitoring services' : 'Monitoring unavailable'}
            </h2>
          </div>
          <StatusBadge label={monitoringStatus} active={monitoringReady} />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <StatusCard icon={<Network className="h-4 w-4" />} label="Edge service" value={serviceStatus} tone={serviceConnected ? 'ok' : 'muted'} detail={serviceConnected ? 'Health response confirmed' : isSimulationActive && !isEdgeConfigured ? 'Service URL not configured' : undefined} />
          <StatusCard icon={<Cpu className="h-4 w-4" />} label="Model" value={modelStatus} detail={isSimulationActive ? health?.model || '--' : '--'} tone={modelReady ? 'ok' : 'muted'} />
          <StatusCard icon={<Camera className="h-4 w-4" />} label="Camera" value={cameraStatus} detail={cameraOnline ? health?.resolution || '--' : undefined} tone={cameraOnline ? 'ok' : health?.camera === 'offline' ? 'danger' : 'muted'} />
          <StatusCard icon={<Crosshair className="h-4 w-4" />} label="Detection status" value={detectionStatus} detail={detectionCount === '--' ? 'Count unavailable' : `${detectionCount} in latest result`} tone={detections === null ? 'muted' : detections.length ? 'accent' : 'ok'} />
          <StatusCard icon={<ShieldAlert className="h-4 w-4" />} label="Damage assessment" value={structuralAssessment} detail={assessmentAvailable ? 'Existing model assessment' : 'Not verified'} tone={structuralAssessment === 'DAMAGE DETECTED' ? 'danger' : 'muted'} />
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <Panel
            title="Camera and detection overlay"
            icon={<ScanEye className="h-4 w-4" />}
            right={<StatusBadge label={monitoringStatus} active={monitoringReady} />}
            bodyClassName="p-0"
          >
            <div className="relative aspect-video overflow-hidden rounded-b-xl bg-[#020811]" aria-label="AI camera monitoring frame">
              {!isSimulationActive ? (
                <StateMessage title="MONITORING IDLE" detail="Start a simulation to connect the chamber camera and edge model." />
              ) : isCameraConfigured ? (
                <img
                  src={CAMERA_STREAM_URL}
                  alt="Raspberry Pi chamber camera stream"
                  className="absolute inset-0 h-full w-full object-contain"
                  onLoad={() => setCameraStreamStatus('online')}
                  onError={() => setCameraStreamStatus('offline')}
                />
              ) : (
                <StateMessage title="CAMERA UNAVAILABLE" detail="No camera stream is configured. No camera image or detections are being generated." />
              )}

              {monitoringReady && detections && result && result.width > 0 && result.height > 0 && detections.length > 0 && (
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox={`0 0 ${result.width} ${result.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  aria-label={`${detections.length} YOLO object detections`}
                >
                  {detections.map((detection, index) => {
                    const label = `${detection.className} ${(detection.confidence * 100).toFixed(1)}%`;
                    const fontSize = Math.max(12, Math.min(42, (14 * result.width) / 960));
                    const labelHeight = fontSize * 1.6;
                    const labelWidth = Math.min(result.width, label.length * fontSize * 0.62 + 12);
                    const labelX = Math.max(0, Math.min(detection.x1, result.width - labelWidth));
                    const labelY = Math.max(0, detection.y1 - labelHeight - 2);
                    return (
                      <g key={`${detection.className}-${index}`}>
                        <rect
                          x={detection.x1}
                          y={detection.y1}
                          width={detection.x2 - detection.x1}
                          height={detection.y2 - detection.y1}
                          fill="none"
                          stroke="#00C8FF"
                          strokeWidth="3"
                          vectorEffect="non-scaling-stroke"
                        />
                        <rect x={labelX} y={labelY} width={labelWidth} height={labelHeight} rx="3" fill="#0B1220" fillOpacity="0.96" stroke="#00C8FF" strokeOpacity="0.85" vectorEffect="non-scaling-stroke" />
                        <text
                          x={labelX + 6}
                          y={labelY + fontSize * 1.2}
                          fill="#F5F8FC"
                          fontSize={fontSize}
                          fontWeight="600"
                          fontFamily="Inter, system-ui, sans-serif"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}

              {isSimulationActive && isCameraConfigured && cameraStreamStatus !== 'online' && (
                <div className="absolute inset-0 flex items-center justify-center bg-base-950/75 px-5 text-center" role="status" aria-live="polite">
                  <div>
                    <p className="text-xs font-bold tracking-[0.12em] text-slate-200">
                      {cameraStreamStatus === 'offline' ? 'CAMERA STREAM UNAVAILABLE' : 'CONNECTING TO CAMERA STREAM'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Live image has not been confirmed by the browser.</p>
                  </div>
                </div>
              )}

              {isSimulationActive && !monitoringReady && isCameraConfigured && (
                <div className="absolute inset-x-0 bottom-0 bg-slate-950/85 px-3 py-2 text-center text-[10px] font-semibold tracking-wider text-slate-300 sm:text-xs">
                  {cameraStatus === 'OFFLINE' ? 'CAMERA OFFLINE' : monitoringStatus}
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="min-w-0 xl:col-span-4">
          <Panel title="Object detection results" icon={<Crosshair className="h-4 w-4" />} className="h-full">
            <div className="flex h-full min-h-56 flex-col">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">Latest backend result</p>
                <span className="rounded-full border border-sky-200/10 bg-base-950/50 px-2.5 py-1 font-mono text-xs text-slate-200">
                  {detectionCount} {detections?.length === 1 ? 'object' : 'objects'}
                </span>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {detections === null ? (
                  <EmptyState
                    title={!isSimulationActive ? 'Monitoring idle' : yolo.loading ? 'Connecting to edge service' : 'Results unavailable'}
                    detail={!isSimulationActive ? 'Start a simulation to enable monitoring.' : error || 'Waiting for an available model and camera.'}
                  />
                ) : detections.length === 0 ? (
                  <EmptyState title="No objects detected" detail="No detections were returned in the latest result." />
                ) : (
                  detections.map((detection, index) => (
                    <div key={`${detection.className}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-base-600/70 bg-base-900/50 px-3 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium text-slate-200" title={detection.className}>{detection.className}</span>
                      <span className="shrink-0 rounded-md bg-accent-400/10 px-2 py-1 font-mono text-xs font-semibold text-accent-200">{(detection.confidence * 100).toFixed(1)}%</span>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-sky-200/10 pt-3">
                <Metric label="Latest detection" value={latestDetection?.className ?? (detections?.length === 0 ? 'None' : '--')} />
                <Metric label="Inference time" value={monitoringReady && result ? `${result.inferenceTimeMs} ms` : '--'} />
                <Metric label="Frame timestamp" value="Unavailable" />
                <Metric label="Camera FPS" value={cameraOnline && health?.fps != null ? `${health.fps} FPS` : '--'} />
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Model information" icon={<Cpu className="h-4 w-4" />} className="h-full">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Metric label="Loaded model" value={isSimulationActive ? health?.model || '--' : '--'} />
            <Metric label="Model status" value={modelStatus} />
            <Metric label="Input resolution" value={cameraOnline ? health?.resolution || '--' : '--'} />
            <Metric label="Inference time" value={monitoringReady && result ? `${result.inferenceTimeMs} ms` : '--'} />
          </div>
          <div className="mt-4 border-t border-sky-200/10 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Model classes</p>
            <p className="mt-1 break-words text-xs leading-relaxed text-slate-300">
              {isSimulationActive && health?.classes?.length ? health.classes.join(', ') : '--'}
            </p>
          </div>
        </Panel>

        <Panel title="Structural damage assessment" icon={<AlertTriangle className="h-4 w-4" />} className="h-full">
          <div className={`flex items-start gap-3 rounded-lg border p-3 ${structuralAssessment === 'DAMAGE DETECTED' ? 'border-danger-400/25 bg-danger-400/[0.05]' : 'border-warn-400/20 bg-warn-400/[0.04]'}`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn-300" aria-hidden="true" />
            <div>
              <p className={`break-words text-xs font-bold tracking-[0.12em] ${structuralAssessment === 'DAMAGE DETECTED' ? 'text-danger-300' : 'text-warn-300'}`}>{structuralAssessment}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {assessmentAvailable
                  ? 'This status comes from the existing damage-specific model-class logic. It is not inferred from unrelated object detections.'
                  : damageAssessmentSupported
                    ? 'A damage-specific model class is available, but no current verified assessment result is available.'
                    : 'Current object detection results are not sufficient to confirm structural damage. No verified damage-specific assessment is available.'}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Assessment history" icon={<Clock3 className="h-4 w-4" />} className="h-full">
          {recordsLoading ? (
            <EmptyState title="Loading saved assessments" detail="Retrieving operator-scoped test records." />
          ) : recordsError ? (
            <EmptyState title="Assessment history unavailable" detail={recordsError} />
          ) : assessmentHistory.length === 0 ? (
            <EmptyState title="No saved assessments" detail="No completed test records contain a supported damage-assessment result." />
          ) : (
            <div className="space-y-2">
              {assessmentHistory.map((record) => {
                const assessmentDate = record.end_time || record.start_time || record.created_at;
                const assessmentTone = 'text-danger-300';
                return (
                  <div key={record.id} className="min-w-0 rounded-lg border border-base-600/70 bg-base-900/50 p-3">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-200" title={record.test_id}>{record.test_id}</p>
                        <p className="mt-1 text-[10px] text-slate-500">{formatRecordDate(assessmentDate)}</p>
                      </div>
                      <span className={`shrink-0 rounded-md bg-base-950/70 px-2 py-1 text-[9px] font-bold tracking-wider ${assessmentTone}`}>
                        {record.ai_overall}
                      </span>
                    </div>
                    <p className="mt-2 break-words text-[10px] leading-relaxed text-slate-400">
                      Damage class: {record.ai_cracks}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Inference status" icon={<Activity className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
          <Metric label="Edge service" value={serviceStatus} />
          <Metric label="Camera connection" value={cameraStatus} />
          <Metric label="Current detection count" value={detectionCount} />
        </div>
        {error && isSimulationActive && <p className="mt-3 break-words rounded-lg border border-warn-400/20 bg-warn-400/[0.04] p-3 text-xs text-warn-300">{error}</p>}
      </Panel>
    </div>
  );
}

function StatusCard({ icon, label, value, detail, tone }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone: 'ok' | 'danger' | 'accent' | 'muted';
}) {
  const toneClass = tone === 'ok' ? 'text-ok-300'
    : tone === 'danger' ? 'text-danger-300'
      : tone === 'accent' ? 'text-accent-300' : 'text-slate-400';
  return (
    <div className="min-w-0 rounded-xl border border-sky-200/10 bg-base-900/80 p-3 sm:p-4">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        <span className={toneClass}>{icon}</span>
        {label}
      </p>
      <p className={`mt-2 truncate text-sm font-bold tracking-wide ${toneClass}`}>{value}</p>
      {detail !== undefined && <p className="mt-1 truncate font-mono text-[10px] text-slate-500" title={detail}>{detail}</p>}
    </div>
  );
}

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-sky-200/10 bg-base-950/50 px-2.5 py-1">
      <StatusDot color={active ? 'ok' : 'warn'} pulse={active} />
      <span className={`text-[9px] font-bold tracking-[0.12em] ${active ? 'text-ok-300' : 'text-slate-400'}`}>{label}</span>
    </span>
  );
}

function StateMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-base-950 px-5 text-center">
      <Camera className="h-8 w-8 text-slate-600" aria-hidden="true" />
      <p className="text-xs font-bold tracking-[0.12em] text-slate-300">{title}</p>
      <p className="max-w-md text-xs leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-base-600/60 bg-base-900/30 px-3 py-5 text-center">
      <p className="text-xs font-semibold text-slate-300">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

function formatRecordDate(value: string | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-words text-xs font-medium text-slate-200" title={value}>{value}</p>
    </div>
  );
}
