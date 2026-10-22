import { CloudSun } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Environment } from '@/components/panels/Environment';

export function EnvironmentView() {
  return (
    <div className="space-y-4">
      <PageHeader title="Environment Monitoring" subtitle="Live temperature and relative humidity from the DHT11 sensor." icon={<CloudSun className="h-5 w-5" />} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Environment />
      </div>
    </div>
  );
}
