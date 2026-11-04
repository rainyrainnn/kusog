import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { isEdgeConfigured, getEdgeHealth, type EdgeHealth } from '@/lib/edgeService';

export type ConnectionStatus = 'online' | 'offline' | 'pending' | 'error';

export type SystemStatus = {
  raspberryPi: ConnectionStatus;
  webcam: ConnectionStatus;
  yolo: ConnectionStatus;
  supabase: ConnectionStatus;
  edgeHealth: EdgeHealth | null;
  lastChecked: Date | null;
};

const initial: SystemStatus = {
  raspberryPi: 'pending',
  webcam: 'pending',
  yolo: 'pending',
  supabase: 'pending',
  edgeHealth: null,
  lastChecked: null,
};

const STATUS_INTERVAL_MS = 5000;
const STATUS_TIMEOUT_MS = 3000;
const listeners = new Set<(status: SystemStatus) => void>();
let sharedStatus = initial;
let timer: number | undefined;
let controller: AbortController | null = null;
let generation = 0;
let checking = false;
let cameraStreamStatus: ConnectionStatus | null = null;
let edgeMonitoringEnabled = false;

function publish(status: SystemStatus) {
  sharedStatus = status;
  listeners.forEach((listener) => listener(status));
}

function reportStreamStatus(status: ConnectionStatus | null) {
  const wasEnabled = edgeMonitoringEnabled;
  cameraStreamStatus = status;
  edgeMonitoringEnabled = status !== null;
  window.dispatchEvent(new CustomEvent('kusog-camera-status', { detail: status }));
  if (wasEnabled !== edgeMonitoringEnabled && listeners.size > 0) {
    generation += 1;
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    controller?.abort();
    controller = null;
    checking = false;
    void checkStatus(generation);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Connection check timed out.')), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function reportCameraStreamStatus(status: ConnectionStatus | null) {
  reportStreamStatus(status);
}

async function checkStatus(currentGeneration: number) {
  if (checking || listeners.size === 0) return;
  checking = true;
  const requestController = new AbortController();
  controller = requestController;
  const timeout = window.setTimeout(() => requestController.abort(), STATUS_TIMEOUT_MS);

  const [edgeResult, supabaseResult] = await Promise.allSettled([
    edgeMonitoringEnabled && isEdgeConfigured
      ? getEdgeHealth(requestController.signal)
      : Promise.reject(new Error('Edge monitoring is inactive.')),
    isSupabaseConfigured ? withTimeout(supabase.auth.getUser(), STATUS_TIMEOUT_MS) : Promise.reject(new Error('Supabase is not configured.')),
  ]);

  window.clearTimeout(timeout);
  if (currentGeneration !== generation || listeners.size === 0) {
    if (controller === requestController) {
      checking = false;
      controller = null;
    }
    return;
  }

  let edgeHealth: EdgeHealth | null = null;
  let raspberryPi: ConnectionStatus = 'offline';
  let webcam: ConnectionStatus = 'offline';
  let yolo: ConnectionStatus = 'offline';
  if (edgeResult.status === 'fulfilled') {
    edgeHealth = edgeResult.value;
    raspberryPi = edgeHealth.status === 'ok' ? 'online' : 'error';
    yolo = edgeHealth.status !== 'ok'
      ? 'error'
      : (edgeHealth.modelReady ?? Boolean(edgeHealth.model)) ? 'online' : 'offline';
    webcam = edgeHealth.camera === 'online'
      ? 'online'
      : edgeHealth.camera === 'offline' ? 'offline' : 'pending';
    if (webcam === 'pending') webcam = 'error';
  } else if (edgeMonitoringEnabled) {
    raspberryPi = requestController.signal.aborted || edgeResult.reason instanceof TypeError ? 'offline' : 'error';
    webcam = raspberryPi;
    yolo = raspberryPi;
  } else {
    raspberryPi = 'pending';
    webcam = 'pending';
    yolo = 'pending';
  }

  let supabaseStatus: ConnectionStatus;
  if (supabaseResult.status === 'fulfilled' && !supabaseResult.value.error && supabaseResult.value.data.user) {
    supabaseStatus = 'online';
  } else if (supabaseResult.status === 'rejected' && supabaseResult.reason instanceof TypeError) {
    supabaseStatus = 'offline';
  } else {
    supabaseStatus = 'error';
  }

  if (cameraStreamStatus !== null) webcam = cameraStreamStatus;
  publish({
    raspberryPi,
    webcam,
    yolo,
    supabase: supabaseStatus,
    edgeHealth,
    lastChecked: new Date(),
  });

  checking = false;
  if (controller === requestController) controller = null;
  if (listeners.size > 0 && currentGeneration === generation) {
    timer = window.setTimeout(() => void checkStatus(currentGeneration), STATUS_INTERVAL_MS);
  }
}

function subscribe(listener: (status: SystemStatus) => void) {
  listeners.add(listener);
  listener(sharedStatus);
  if (listeners.size === 1) {
    generation += 1;
    void checkStatus(generation);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      generation += 1;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      controller?.abort();
      controller = null;
      checking = false;
    }
  };
}

export function useSystemStatus() {
  const [status, setStatus] = useState(sharedStatus);

  useEffect(() => {
    const unsubscribe = subscribe(setStatus);
    const handleCameraStatus = (event: Event) => {
      const detail = (event as CustomEvent<ConnectionStatus | null>).detail;
      cameraStreamStatus = detail;
      const webcam = detail ?? (
        sharedStatus.edgeHealth?.camera === 'online'
          ? 'online'
          : sharedStatus.edgeHealth?.camera === 'offline' ? 'offline' : sharedStatus.webcam
      );
      publish({ ...sharedStatus, webcam });
    };
    window.addEventListener('kusog-camera-status', handleCameraStatus);
    return () => {
      window.removeEventListener('kusog-camera-status', handleCameraStatus);
      unsubscribe();
    };
  }, []);

  return status;
}
