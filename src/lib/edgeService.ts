export type EdgeHealth = {
  status: 'ok' | 'error';
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
export const CAMERA_STREAM_URL = (import.meta.env.VITE_KUSOG_CAMERA_URL as string | undefined)?.trim() || '';
export const isEdgeConfigured = Boolean(EDGE_URL && !isPlaceholderUrl(EDGE_URL));
export const isCameraConfigured = Boolean(CAMERA_STREAM_URL && !isPlaceholderUrl(CAMERA_STREAM_URL));

export async function getEdgeHealth(signal?: AbortSignal): Promise<EdgeHealth> {
  if (!isEdgeConfigured) throw new Error('VITE_KUSOG_EDGE_URL is not configured.');
  const response = await fetch(`${EDGE_URL}/health`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Edge server returned HTTP ${response.status}.`);
  return (await response.json()) as EdgeHealth;
}

export async function getDetections(signal?: AbortSignal): Promise<EdgeDetectionResponse> {
  if (!isEdgeConfigured) throw new Error('VITE_KUSOG_EDGE_URL is not configured.');
  const response = await fetch(`${EDGE_URL}/detections`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Detection server returned HTTP ${response.status}.`);
  return (await response.json()) as EdgeDetectionResponse;
}

export async function detectImage(blob: Blob, signal?: AbortSignal): Promise<EdgeDetectionResponse> {
  if (!isEdgeConfigured) throw new Error('VITE_KUSOG_EDGE_URL is not configured.');
  const response = await fetch(`${EDGE_URL}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
    signal,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Detection server returned HTTP ${response.status}.`);
  }
  return (await response.json()) as EdgeDetectionResponse;
}
