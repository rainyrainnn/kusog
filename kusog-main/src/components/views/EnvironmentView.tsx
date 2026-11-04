import { CloudSun } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { SensorMonitoring } from '@/components/panels/Environment';
import type { Simulation } from '@/hooks/useSimulation';
import type { WindSensorData } from '@/lib/windSensor';
import type { LoadCellData } from '@/lib/loadCell';
import type { RainSensorData } from '@/lib/rainSensor';

export function EnvironmentView({ sim, wind, loadCell, rain, rainLoading }: {
  sim: Simulation;
  wind: WindSensorData;
  loadCell: LoadCellData;
  rain: RainSensorData;
  rainLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <PageHeader title="Sensor Monitoring" subtitle="Live environmental, pressure, wind, rainfall, and uplift readings from connected sensors." icon={<CloudSun className="h-5 w-5" />} />
      <SensorMonitoring
        active={sim.isTestRunning && !sim.isFinalizing}
        wind={wind}
        loadCell={loadCell}
        rain={rain}
        rainLoading={rainLoading}
        windHistory={sim.windHist}
      />
    </div>
  );
}
