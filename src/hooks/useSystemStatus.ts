import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { isEdgeConfigured, getEdgeHealth, type EdgeHealth } from '@/lib/edgeService';

export type ConnectionStatus = 'online' | 'offline' | 'pending';

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

let cameraStreamStatus: ConnectionStatus | null = null;

export function reportCameraStreamStatus(status: ConnectionStatus | null) {
  cameraStreamStatus = status;
  window.dispatchEvent(new CustomEvent('kusog-camera-status', { detail: status }));
}

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>(initial);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const check = async () => {
      if (cancelled) return;
      const next: SystemStatus = {
        raspberryPi: 'offline',
        webcam: 'offline',
        yolo: 'offline',
        supabase: 'offline',
        edgeHealth: null,
        lastChecked: new Date(),
      };

      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.auth.getSession();
          next.supabase = error ? 'offline' : 'online';
        } catch {
          next.supabase = 'offline';
        }
      }

      // Raspberry Pi + YOLO are derived from the edge server; the camera panel uses the Pi MJPEG stream directly.
      if (isEdgeConfigured) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 3000);
        try {
          const health = await getEdgeHealth(controller.signal);
          next.edgeHealth = health;
          next.raspberryPi = health.status === 'ok' ? 'online' : 'offline';
          next.yolo = health.status === 'ok' && (health.modelReady ?? Boolean(health.model)) ? 'online' : 'offline';
          next.webcam = health.camera === 'online' ? 'online' : 'offline';
        } catch {
          next.raspberryPi = 'offline';
          next.yolo = 'offline';
        } finally {
          window.clearTimeout(timeout);
        }
      }

      if (
        cameraStreamStatus !== null
        && (!next.edgeHealth || next.edgeHealth.camera === undefined || next.edgeHealth.camera === 'unknown')
      ) {
        next.webcam = cameraStreamStatus;
      }
      if (!cancelled) setStatus(next);
      if (!cancelled) timer = window.setTimeout(check, 5000);
    };

    const handleCameraStatus = (event: Event) => {
      const detail = (event as CustomEvent<ConnectionStatus | null>).detail;
      if (detail === null) {
        setStatus((current) => {
          const edgeCamera = current.edgeHealth?.camera;
          return {
            ...current,
            webcam: edgeCamera === 'online' ? 'online' : 'offline',
          };
        });
      } else if (
        (detail === 'online' || detail === 'offline' || detail === 'pending')
      ) {
        setStatus((current) => {
          const edgeCamera = current.edgeHealth?.camera;
          if (edgeCamera === 'online' || edgeCamera === 'offline') return current;
          return { ...current, webcam: detail };
        });
      }
    };

    window.addEventListener('kusog-camera-status', handleCameraStatus);
    check();
    return () => {
      cancelled = true;
      window.removeEventListener('kusog-camera-status', handleCameraStatus);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return status;
}
