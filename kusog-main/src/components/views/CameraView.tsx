import { useCallback } from 'react';
import { Camera } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { CameraFeed } from '@/components/panels/CameraFeed';
import type { Simulation } from '@/hooks/useSimulation';
import { useYoloDetections } from '@/hooks/useYoloDetections';
import type { EdgeDetectionResponse, EdgeHealth } from '@/lib/edgeService';

export function CameraView({ sim }: { sim: Simulation }) {
  const recordYoloAssessment = sim.recordYoloAssessment;
  const handleYoloResult = useCallback((health: EdgeHealth, result: EdgeDetectionResponse) => {
    const analysisReady = health.status === 'ok'
      && (health.modelReady ?? Boolean(health.model))
      && health.camera === 'online';
    recordYoloAssessment(result.detections, analysisReady, health.classes ?? []);
  }, [recordYoloAssessment]);
  const isSimulationActive = sim.isDevicesActive && !sim.isFinalizing;
  const yolo = useYoloDetections(isSimulationActive, handleYoloResult);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live Camera Feed"
        subtitle="Chamber video stream and real-time edge object detection."
        icon={<Camera className="h-4 w-4" />}
      />
      <CameraFeed
        isSimulationRunning={isSimulationActive}
        yolo={yolo}
        structuralAssessment={sim.aiDetections.overall}
      />
    </div>
  );
}
