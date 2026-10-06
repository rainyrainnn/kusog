export type EdgeHealth = {
  status: 'ok' | 'error';
  model?: string;
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

export const EDGE_URL = (import.meta.env.VITE_KUSOG_EDGE_URL as string | undefined)?.replace(/\/$/, '') || '';
export const CAMERA_STREAM_URL = (import.meta.env.VITE_KUSOG_CAMERA_URL as string | undefined)?.trim() || 'http://10.155.180.176:5000/video';

export async function getEdgeHealth(signal?: AbortSignal): Promise<EdgeHealth> {
  if (!EDGE_URL) throw new Error('VITE_KUSOG_EDGE_URL is not configured.');
  const response = await fetch(`${EDGE_URL}/health`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Edge server returned HTTP ${response.status}.`);
  return (await response.json()) as EdgeHealth;
}

export async function getDetections(signal?: AbortSignal): Promise<EdgeDetectionResponse> {
  if (!EDGE_URL) throw new Error('VITE_KUSOG_EDGE_URL is not configured.');
  const response = await fetch(`${EDGE_URL}/detections`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Detection server returned HTTP ${response.status}.`);
  return (await response.json()) as EdgeDetectionResponse;
}

export async function detectImage(blob: Blob, signal?: AbortSignal): Promise<EdgeDetectionResponse> {
  if (!EDGE_URL) throw new Error('VITE_KUSOG_EDGE_URL is not configured.');
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
