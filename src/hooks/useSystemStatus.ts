import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isEdgeConfigured, getEdgeHealth, type EdgeHealth } from '@/lib/edgeService';
import { isSupabaseConfigured } from '@/lib/supabase';

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

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>(initial);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const check = async () => {
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
        try {
          const health = await getEdgeHealth();
          next.edgeHealth = health;
          next.raspberryPi = health.status === 'ok' ? 'online' : 'offline';
          next.yolo = health.status === 'ok' && health.model ? 'online' : 'offline';
          next.webcam = health.camera === 'online' ? 'online' : 'offline';
        } catch {
          next.raspberryPi = 'offline';
          next.yolo = 'offline';
        }
      }

      if (!cancelled) setStatus(next);
      timer = window.setTimeout(check, 5000);
    };

    check();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return status;
}
