import type { Simulation } from '@/hooks/useSimulation';
import type { RouteId } from '@/components/Sidebar';
import { CameraFeed } from '@/components/panels/CameraFeed';
import { WindGauge } from '@/components/panels/WindGauge';
import { FanControl } from '@/components/panels/FanControl';
import { RainControl } from '@/components/panels/RainControl';
import { WindDirection } from '@/components/panels/WindDirection';
import { Environment } from '@/components/panels/Environment';
import { StructuralStatus } from '@/components/panels/StructuralStatus';
import { ForceGraph } from '@/components/panels/Graphs';
import { TestLog } from '@/components/panels/TestLog';
import { AiAssessment } from '@/components/panels/AiAssessment';
import { ReportGeneration } from '@/components/panels/ReportGeneration';
import { HouseSetup } from '@/components/panels/HouseSetup';

export function DashboardView({ sim, onNavigate }: { sim: Simulation; onNavigate: (r: RouteId) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-6 xl:col-span-5">
          <CameraFeed sim={sim} onExpand={() => onNavigate('camera')} />
        </div>
        <div className="col-span-6 lg:col-span-3 xl:col-span-2">
          <WindGauge sim={sim} />
        </div>
        <div className="col-span-6 lg:col-span-3 xl:col-span-2">
          <FanControl sim={sim} />
        </div>
        <div className="col-span-12 xl:col-span-3">
          <RainControl sim={sim} />
        </div>
      </div>

      {/* House model & materials — must be filled before starting a test */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12">
          <HouseSetup sim={sim} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 md:col-span-6 lg:col-span-4">
          <WindDirection sim={sim} />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-4">
          <Environment sim={sim} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <StructuralStatus sim={sim} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12">
          <ForceGraph sim={sim} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-4">
          <TestLog sim={sim} />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <AiAssessment sim={sim} />
        </div>
        <div className="col-span-12 lg:col-span-3">
          <ReportGeneration sim={sim} />
        </div>
      </div>
    </div>
  );
}
