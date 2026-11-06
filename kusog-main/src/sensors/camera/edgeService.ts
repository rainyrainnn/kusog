export type EdgeHealth = {
  status: 'ok' | 'error';
  modelReady?: boolean;
  model?: string;
  classes?: string[];
  camera?: 'online' | 'offline' | 'unknown';
  resolution?: string | null;
  fps?: number | null;
};

export type EdgeDetection = {
  className: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type EdgeDetectionResponse = {
  detections: EdgeDetection[];
  inferenceTimeMs: number;
  width: number;
  height: number;
};

export function isDamageClassName(className: string): boolean {
  if (/\bno\s+damage\b/i.test(className)) return false;
  return /(^|[^a-z])(damage|damaged|crack|cracked|collapse|collapsed|deform|deformation|broken|failure)(?=$|[^a-z])/i.test(className);
}

export function hasDamageClasses(classNames: string[] | undefined): boolean {
  return Boolean(classNames?.some(isDamageClassName));
}

const isPlaceholderUrl = (value: string) => /your_|<.*>|YOUR_/i.test(value);

export const EDGE_URL = (import.meta.env.VITE_KUSOG_EDGE_URL as string | undefined)?.trim().replace(/\/$/, '') || '';
const EDGE_API_URL = import.meta.env.DEV ? '/kusog-edge' : EDGE_URL;
const configuredCameraUrl = (import.meta.env.VITE_KUSOG_CAMERA_URL as string | undefined)?.trim() || '';
const isCameraUrlConfigured = configuredCameraUrl
  ? !isPlaceholderUrl(configuredCameraUrl)
  : Boolean(EDGE_URL && !isPlaceholderUrl(EDGE_URL));
export const CAMERA_STREAM_URL = import.meta.env.DEV
  ? (configuredCameraUrl || EDGE_URL ? '/kusog-camera' : '')
  : configuredCameraUrl || (EDGE_URL ? `${EDGE_URL}/camera` : '');
export const isEdgeConfigured = Boolean(EDGE_URL && !isPlaceholderUrl(EDGE_URL));
export const isCameraConfigured = Boolean(CAMERA_STREAM_URL && isCameraUrlConfigured);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseEdgeHealth(value: unknown): EdgeHealth {
  if (!isRecord(value) || (value.status !== 'ok' && value.status !== 'error')) {
    throw new Error('The edge server returned an invalid health response.');
  }
  if (value.modelReady !== undefined && typeof value.modelReady !== 'boolean') {
    throw new Error('The edge server returned an invalid modelReady value.');
  }
  if (value.model !== undefined && typeof value.model !== 'string') {
    throw new Error('The edge server returned an invalid model value.');
  }
  if (value.classes !== undefined && (!Array.isArray(value.classes) || !value.classes.every((item) => typeof item === 'string'))) {
    throw new Error('The edge server returned an invalid classes value.');
  }
  if (value.camera !== undefined && value.camera !== 'online' && value.camera !== 'offline' && value.camera !== 'unknown') {
    throw new Error('The edge server returned an invalid camera status.');
  }
  if (value.resolution !== undefined && value.resolution !== null && typeof value.resolution !== 'string') {
    throw new Error('The edge server returned an invalid resolution value.');
  }
  if (value.fps !== undefined && value.fps !== null && (typeof value.fps !== 'number' || !Number.isFinite(value.fps))) {
    throw new Error('The edge server returned an invalid fps value.');
  }
  return value as EdgeHealth;
}

function parseDetectionResponse(value: unknown): EdgeDetectionResponse {
  if (!isRecord(value)
    || !Array.isArray(value.detections)
    || typeof value.inferenceTimeMs !== 'number'
    || !Number.isFinite(value.inferenceTimeMs)
    || typeof value.width !== 'number'
    || !Number.isFinite(value.width)
    || typeof value.height !== 'number'
    || !Number.isFinite(value.height)) {
    throw new Error('The edge server returned an invalid detections response.');
  }

  const detections = value.detections.map((detection) => {
    if (!isRecord(detection)
      || typeof detection.className !== 'string'
      || typeof detection.confidence !== 'number'
      || !Number.isFinite(detection.confidence)
      || !['x1', 'y1', 'x2', 'y2'].every((key) => typeof detection[key] === 'number' && Number.isFinite(detection[key]))) {
      throw new Error('The edge server returned an invalid detection.');
    }
    return detection as EdgeDetection;
  });

  return {
    detections,
    inferenceTimeMs: value.inferenceTimeMs,
    width: value.width,
    height: value.height,
  };
}

export async function getEdgeHealth(signal?: AbortSignal): Promise<EdgeHealth> {
  if (!isEdgeConfigured) throw new Error('VITE_KUSOG_EDGE_URL is not configured.');
  const response = await fetch(`${EDGE_API_URL}/health`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Edge server returned HTTP ${response.status}.`);
  return parseEdgeHealth(await response.json());
}

export async function getDetections(signal?: AbortSignal): Promise<EdgeDetectionResponse> {
  if (!isEdgeConfigured) throw new Error('VITE_KUSOG_EDGE_URL is not configured.');
  const response = await fetch(`${EDGE_API_URL}/detections`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Detection server returned HTTP ${response.status}.`);
  return parseDetectionResponse(await response.json());
}

export async function detectImage(blob: Blob, signal?: AbortSignal): Promise<EdgeDetectionResponse> {
  if (!isEdgeConfigured) throw new Error('VITE_KUSOG_EDGE_URL is not configured.');
  const response = await fetch(`${EDGE_API_URL}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
    signal,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Detection server returned HTTP ${response.status}.`);
  }
  return parseDetectionResponse(await response.json());
}


export async function setEdgeSimulationActive(active: boolean): Promise<void> {
  const response = await fetch(
    `${EDGE_API_URL}/simulation/${active ? 'start' : 'stop'}`,
    { method: 'POST' }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to ${active ? 'start' : 'stop'} edge simulation: HTTP ${response.status}`
    );
  }
}
