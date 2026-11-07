import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  Cpu,
  Maximize2,
  Minimize2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { Panel } from '../Panel';
import { CAMERA_STREAM_URL, hasDamageClasses, isCameraConfigured } from '@/lib/edgeService';
import { reportCameraStreamStatus, useSystemStatus } from '@/hooks/useSystemStatus';
import type { YoloDetectionState } from '@/hooks/useYoloDetections';
import type { EdgeHealth } from '@/lib/edgeService';

const STREAM_LOAD_TIMEOUT_MS = 8000;

type CameraStreamStatus = 'connecting' | 'online' | 'offline';

type CameraFeedProps = {
  onExpand?: () => void;
  isSimulationRunning: boolean;
  yolo: YoloDetectionState;
  structuralAssessment?: string;
  compact?: boolean;
};

function isModelReady(health: EdgeHealth | null): boolean {
  return Boolean(health && health.status === 'ok' && (health.modelReady ?? Boolean(health.model)));
}

function formatTime(date: Date | null): string {
  return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';
}

export function CameraFeed({ onExpand, isSimulationRunning, yolo, structuralAssessment = 'NOT ASSESSED', compact = false }: CameraFeedProps) {
  const system = useSystemStatus();
  const frameRef = useRef<HTMLDivElement>(null);
  const [streamStatus, setStreamStatus] = useState<CameraStreamStatus>(
    isCameraConfigured ? 'connecting' : 'offline',
  );
  const [streamAttempt, setStreamAttempt] = useState(0);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamConnectedAt, setStreamConnectedAt] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [frameWidth, setFrameWidth] = useState(0);

  const online = streamStatus === 'online';
  const modelReady = isModelReady(yolo.health);
  const yoloReady = modelReady && yolo.health?.camera === 'online';
  const detectionResult = online && yoloReady ? yolo.result : null;
  const resolution = online
    ? yolo.health?.resolution
      || system.edgeHealth?.resolution
      || (detectionResult ? `${detectionResult.width} × ${detectionResult.height}` : '--')
    : '--';
  const fps = online ? yolo.health?.fps ?? system.edgeHealth?.fps ?? null : null;
  const statusLabel = !isCameraConfigured
    ? 'DEMO DATA'
    : streamStatus === 'connecting'
      ? 'CONNECTING'
      : streamError
        ? 'ERROR'
        : online
          ? 'ONLINE'
          : 'OFFLINE';
  const statusTone = statusLabel === 'ONLINE'
    ? 'text-ok-400'
    : statusLabel === 'ERROR' || statusLabel === 'OFFLINE'
      ? 'text-danger-400'
      : statusLabel === 'CONNECTING'
        ? 'text-warn-400'
        : statusLabel === 'DEMO DATA'
          ? 'text-accent-300'
          : 'text-slate-400';
  const detectionCount = detectionResult?.detections.length ?? null;
  const latestDetection = detectionResult?.detections[detectionResult.detections.length - 1] ?? null;
  const inferenceTime = detectionResult?.inferenceTimeMs ?? null;
  const overlayFontSize = detectionResult && frameWidth > 0
    ? Math.max(12, Math.min(56, (12 * detectionResult.width) / frameWidth))
    : 12;
  const damageAssessmentSupported = hasDamageClasses(yolo.health?.classes);
  const assessmentLabel = !isSimulationRunning
    ? 'IDLE'
    : !yoloReady
      ? yolo.loading ? 'CONNECTING' : 'UNAVAILABLE'
      : damageAssessmentSupported ? structuralAssessment : 'NOT ASSESSED';

  useEffect(() => {
    reportCameraStreamStatus(isCameraConfigured ? 'pending' : 'offline');
    return () => reportCameraStreamStatus(null);
  }, []);

  useEffect(() => () => reportCameraStreamStatus(null), []);

  useEffect(() => {
    if (!isCameraConfigured || streamStatus !== 'offline') return;
    const retry = window.setTimeout(() => {
      setStreamError(null);
      setStreamConnectedAt(null);
      setStreamStatus('connecting');
      setStreamAttempt((attempt) => attempt + 1);
    }, 5000);
    return () => window.clearTimeout(retry);
  }, [streamStatus, streamAttempt]);

  useEffect(() => {
    if (!isCameraConfigured || streamStatus !== 'connecting') return;
    const timeout = window.setTimeout(() => {
      setStreamError(`No camera frame received within ${STREAM_LOAD_TIMEOUT_MS / 1000} seconds from ${CAMERA_STREAM_URL}. Check the configured Pi address, stream route, and browser network/mixed-content errors.`);
      setStreamStatus('offline');
      reportCameraStreamStatus('offline');
    }, STREAM_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [streamAttempt, streamStatus]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === frameRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const updateWidth = () => setFrameWidth(frame.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const refreshStream = () => {
    if (!isCameraConfigured) return;
    setStreamError(null);
    setStreamConnectedAt(null);
    setStreamStatus('connecting');
    reportCameraStreamStatus('pending');
    setStreamAttempt((attempt) => attempt + 1);
  };

  const handleStreamLoad = () => {
    setStreamError(null);
    setStreamConnectedAt(new Date());
    setStreamStatus('online');
    reportCameraStreamStatus('online');
  };

  const handleStreamError = () => {
    setStreamError(`Unable to load the camera stream at ${CAMERA_STREAM_URL}. Check that the Pi service is reachable and serves the configured stream route.`);
    setStreamStatus('offline');
    reportCameraStreamStatus('offline');
  };

  const toggleFullscreen = async () => {
    const frame = frameRef.current;
    if (!frame) return;

    try {
      if (document.fullscreenElement === frame) {
        await document.exitFullscreen();
      } else {
        await frame.requestFullscreen();
      }
    } catch (error) {
      console.error('Unable to change camera fullscreen mode:', error);
    }
  };

  return (
    <Panel
      title="Live Chamber Camera"
      icon={<Camera className="h-4 w-4" />}
      right={
        <span
          role="status"
          aria-live="polite"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-sky-200/15 bg-base-950/70 px-2.5 py-1.5"
        >
          <span className={`relative h-2 w-2 shrink-0 rounded-full ${statusLabel === 'ONLINE' ? 'bg-ok-400' : statusLabel === 'OFFLINE' || statusLabel === 'ERROR' ? 'bg-danger-400' : statusLabel === 'CONNECTING' ? 'bg-warn-400' : statusLabel === 'DEMO DATA' ? 'bg-accent-300' : 'bg-slate-500'}`}>
            {statusLabel === 'ONLINE' && <span className="absolute inset-0 animate-ping rounded-full bg-ok-400 opacity-30" />}
          </span>
          <span className={`text-[9px] font-bold tracking-[0.14em] ${statusTone}`}>{statusLabel}</span>
        </span>
      }
      className="h-full overflow-hidden"
      bodyClassName="p-0"
    >
      <div
        ref={frameRef}
        className={`relative isolate w-full overflow-hidden bg-[#050b16] ring-1 ring-inset ring-white/[0.06] ${isFullscreen ? 'h-[100dvh] w-screen' : compact ? 'h-[280px] sm:h-[320px] xl:h-[360px]' : 'aspect-video'}`}
        aria-label="Chamber camera video frame"
      >
        {isCameraConfigured && streamStatus !== 'offline' ? (
          <>
            <img
              key={streamAttempt}
              src={CAMERA_STREAM_URL}
              alt="Raspberry Pi chamber camera stream"
              className="absolute inset-0 h-full w-full object-contain"
              onLoad={handleStreamLoad}
              onError={handleStreamError}
            />
            {streamStatus === 'connecting' && (
              <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-2 bg-base-950/75 text-center">
                <RefreshCw className="h-6 w-6 animate-spin text-accent-300" aria-hidden="true" />
                <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-200">CONNECTING TO CAMERA</p>
                <p className="text-[10px] text-slate-400">Waiting for the first available frame</p>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-base-950">
            <span className={`grid h-14 w-14 place-items-center rounded-2xl border ${isCameraConfigured ? 'border-danger-400/20 bg-danger-400/[0.06] text-danger-300' : 'border-accent-400/20 bg-accent-400/[0.06] text-accent-300'}`}>
              <Camera className="h-7 w-7" aria-hidden="true" />
            </span>
            <div className="max-w-md px-5 text-center">
              <p className={`text-xs font-bold tracking-[0.14em] ${isCameraConfigured ? 'text-danger-300' : 'text-accent-300'}`}>
                {isCameraConfigured ? streamError ? 'CAMERA STREAM ERROR' : 'CAMERA OFFLINE' : 'DEMO DATA · NO CAMERA STREAM'}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {isCameraConfigured
                  ? streamError ? 'The configured stream is unavailable. Check the camera service and retry the connection.' : 'No live camera frame is available. Check the edge camera connection and retry.'
                  : 'Camera hardware is not configured. No live video or detections are being shown.'}
              </p>
              {streamError && <p className="mt-2 break-words text-[10px] leading-relaxed text-slate-500">{streamError}</p>}
            </div>
          </div>
        )}

        {detectionResult && detectionResult.width > 0 && detectionResult.height > 0 && detectionResult.detections.length > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
            viewBox={`0 0 ${detectionResult.width} ${detectionResult.height}`}
            preserveAspectRatio="xMidYMid meet"
            aria-label={`${detectionResult.detections.length} YOLO detections`}
          >
            {detectionResult.detections.map((detection, index) => {
              const label = `${detection.className} ${(detection.confidence * 100).toFixed(1)}%`;
              const labelHeight = overlayFontSize * 1.6;
              const labelWidth = Math.min(detectionResult.width, label.length * overlayFontSize * 0.62 + 12);
              const labelX = Math.max(0, Math.min(detection.x1, detectionResult.width - labelWidth));
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
                    y={labelY + overlayFontSize * 1.2}
                    fill="#F5F8FC"
                    fontSize={overlayFontSize}
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

      </div>

      <div className="grid grid-cols-2 gap-px border-t border-sky-200/10 bg-sky-200/[0.06] sm:grid-cols-3 xl:grid-cols-5">
        <InfoCell label="Connection" value={statusLabel} tone={statusTone} />
        <InfoCell label="Source" value={isCameraConfigured ? 'Configured Pi stream' : '--'} />
        <InfoCell label="Resolution" value={resolution} />
        <InfoCell label="Frame rate" value={fps === null ? '--' : `${fps} FPS`} />
        <InfoCell label="Connected since" value={online ? formatTime(streamConnectedAt) : '--'} icon />
      </div>

      <div className="flex flex-col gap-3 border-t border-sky-200/10 bg-base-950/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-slate-300">
            {detectionCount === null
              ? isSimulationRunning ? 'Object detections unavailable' : 'Object detection idle'
              : detectionCount === 0 ? 'No objects detected in the latest result' : `${detectionCount} object ${detectionCount === 1 ? 'detection' : 'detections'} in latest result`}
          </p>
          <p className="mt-1 text-[9px] leading-relaxed text-slate-500">Real-time YOLO damage detections are shown when returned by the Raspberry Pi.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
          <button
            type="button"
            onClick={refreshStream}
            disabled={!isCameraConfigured || streamStatus === 'connecting'}
            className="inline-flex h-9 min-w-28 flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-200/15 bg-base-800/70 px-3 text-[10px] font-semibold text-slate-300 transition-colors hover:border-accent-400/40 hover:bg-accent-400/[0.06] hover:text-accent-200 focus-visible:outline-accent-400 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            title="Reconnect camera stream"
            aria-label={streamStatus === 'connecting' ? 'Camera is connecting' : 'Reconnect camera stream'}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${streamStatus === 'connecting' ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Reconnect</span>
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex h-9 min-w-28 flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-200/15 bg-base-800/70 px-3 text-[10px] font-semibold text-slate-300 transition-colors hover:border-accent-400/40 hover:bg-accent-400/[0.06] hover:text-accent-200 focus-visible:outline-accent-400 sm:flex-none"
            title={isFullscreen ? 'Exit fullscreen' : 'View camera fullscreen'}
            aria-label={isFullscreen ? 'Exit camera fullscreen' : 'View camera fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
          </button>
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="inline-flex h-9 min-w-28 flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-200/15 bg-base-800/70 px-3 text-[10px] font-semibold text-slate-300 transition-colors hover:border-accent-400/40 hover:bg-accent-400/[0.06] hover:text-accent-200 focus-visible:outline-accent-400 sm:flex-none"
              title="Open camera monitoring page"
              aria-label="Open camera monitoring page"
            >
              <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Monitor</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-px border-t border-sky-200/10 bg-sky-200/[0.06] sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCell
          label="Detection count"
          value={detectionCount === null ? '--' : String(detectionCount)}
          detail={detectionCount === null ? isSimulationRunning ? 'Waiting for camera and model' : 'Inactive' : 'Current YOLO result'}
          icon={<ScanLine className="h-4 w-4" aria-hidden="true" />}
        />
        <SummaryCell
          label="Latest detection"
          value={latestDetection?.className ?? (detectionCount === 0 ? 'None' : '--')}
          detail={latestDetection ? `${(latestDetection.confidence * 100).toFixed(1)}% confidence` : 'Object detection only'}
          icon={<Activity className="h-4 w-4" aria-hidden="true" />}
        />
        <SummaryCell
          label="YOLO model"
          value={isSimulationRunning ? yolo.health?.model || (modelReady ? 'Loaded model' : '--') : '--'}
          detail={`${yoloReady ? 'READY' : isSimulationRunning ? yolo.loading ? 'CONNECTING' : 'UNAVAILABLE' : 'IDLE'} · Inference ${inferenceTime === null ? '--' : `${inferenceTime} ms`}`}
          icon={<Cpu className="h-4 w-4" aria-hidden="true" />}
        />
        <SummaryCell
          label="Structural assessment"
          value={assessmentLabel}
          detail={damageAssessmentSupported ? 'Model reports damage-specific classes' : 'Not inferred from object detections'}
          icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
        />
      </div>
    </Panel>
  );
}

function SummaryCell({ label, value, detail, icon }: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="min-w-0 bg-base-900/90 px-3.5 py-3.5">
      <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        <span className="text-accent-300">{icon}</span>
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-100" title={value}>{value}</p>
      <p className="mt-1 break-words text-[9px] leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

function InfoCell({ label, value, tone = 'text-slate-200', icon = false }: {
  label: string;
  value: string;
  tone?: string;
  icon?: boolean;
}) {
  return (
    <div className="min-w-0 bg-base-950/50 px-3.5 py-2.5">
      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1 flex items-center gap-1.5 truncate font-mono text-[10px] font-semibold ${tone}`}>
        {icon && <Timer className="h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />}
        {value}
      </p>
    </div>
  );
}
