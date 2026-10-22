import { Camera } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { CameraFeed } from '@/components/panels/CameraFeed';

export function CameraView() {
  return (
    <div className="space-y-3">
      <PageHeader title="Camera Monitoring" subtitle="Raspberry Pi 5 edge camera and live stream" icon={<Camera className="h-4 w-4" />} />
      <div className="min-h-[calc(100vh-170px)]">
        <CameraFeed onExpand={() => undefined} />
      </div>
    </div>
  );
}
