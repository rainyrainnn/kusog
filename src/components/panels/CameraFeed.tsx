import { useState } from 'react';
import { Camera, Maximize2, RefreshCw, WifiOff } from 'lucide-react';
import { Panel, StatusDot } from '../Panel';
import type { Simulation } from '@/hooks/useSimulation';
import { CAMERA_STREAM_URL } from '@/lib/edgeService';
import { useSystemStatus } from '@/hooks/useSystemStatus';

export function CameraFeed({ sim: _sim, onExpand }: { sim: Simulation; onExpand: () => void }) {
  const system = useSystemStatus();
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [streamAttempt, setStreamAttempt] = useState(0);
  const online = streamStatus === 'online';
  const resolution = system.edgeHealth?.resolution || '—';
  const fps = system.edgeHealth?.fps ?? null;

  const refreshStream = () => {
    setStreamStatus('connecting');
    setStreamAttempt((attempt) => attempt + 1);
  };

  return (
    <Panel
      title="Live Chamber Camera"
      icon={<Camera className="h-4 w-4" />}
      right={
        <span className="flex items-center gap-1.5">
          <StatusDot color={online ? 'ok' : 'warn'} pulse={online} />
          <span className={`text-[10px] font-bold tracking-wider ${online ? 'text-ok-400' : 'text-warn-400'}`}>
            {online ? 'ONLINE' : streamStatus === 'offline' ? 'OFFLINE' : 'CONNECTING'}
          </span>
        </span>
      }
      className="h-full"
      bodyClassName="p-0"
    >
      <div className="relative h-full min-h-[260px] overflow-hidden rounded-b-xl bg-base-950">
        {streamStatus !== 'offline' ? (
          <img
            key={streamAttempt}
            src={CAMERA_STREAM_URL}
            alt="Live Raspberry Pi chamber camera"
            className="h-full w-full object-contain"
            onLoad={() => setStreamStatus('online')}
            onError={() => setStreamStatus('offline')}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-base-950">
            <WifiOff className="h-10 w-10 text-slate-600" />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-300">Raspberry Pi Camera Waiting</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                The Raspberry Pi video stream is unreachable. Check that the Pi is online and serving the MJPEG endpoint, then reconnect.
              </p>
            </div>
          </div>
        )}

        {online && (
          <div className="absolute left-3 top-3 font-mono text-[10px] leading-relaxed text-accent-400/90">
            <div>CHAMBER-A · LIVE</div>
            <div>{resolution}{fps !== null ? ` · ${fps} FPS` : ''}</div>
          </div>
        )}

        <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
          <button onClick={refreshStream} className="grid h-8 w-8 place-items-center rounded-lg border border-base-600/70 bg-base-800/90 text-slate-300 hover:text-accent-400" title="Reconnect camera stream">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button onClick={onExpand} className="grid h-8 w-8 place-items-center rounded-lg border border-accent-500/40 bg-accent-500/10 text-accent-400 hover:bg-accent-500 hover:text-white" title="Open full camera view">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="border-t border-base-700/60 bg-base-900/80 p-3">
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="rounded-lg border border-base-600/70 bg-base-950/40 p-2">
            <div className="text-slate-600">Camera</div>
            <div className={`mt-0.5 font-bold ${online ? 'text-ok-400' : 'text-slate-500'}`}>{online ? 'ONLINE' : 'NOT CONNECTED'}</div>
          </div>
          <div className="rounded-lg border border-base-600/70 bg-base-950/40 p-2">
            <div className="text-slate-600">Resolution</div>
            <div className="mt-0.5 font-mono text-slate-300">{resolution}</div>
          </div>
          <div className="rounded-lg border border-base-600/70 bg-base-950/40 p-2">
            <div className="text-slate-600">FPS</div>
            <div className="mt-0.5 font-mono text-slate-300">{fps ?? '—'}</div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
