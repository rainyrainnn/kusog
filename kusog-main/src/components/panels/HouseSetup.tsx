import { useState, useEffect } from 'react';
import { Home, ChevronDown, CheckCircle2, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Panel } from '@/components/Panel';
import type { Simulation, HouseSelection } from '@/hooks/useSimulation';
import {
  DEFAULT_HOUSE_MODELS,
  WALL_MATERIALS,
  ROOF_MATERIALS,
  FLOOR_MATERIALS,
} from '@/lib/houseModels';
import { fetchHouseModels } from '@/lib/testRecords';

type DbHouseModel = { id: string; name: string; description: string | null; image_url: string | null; is_active: boolean };

export function HouseSetup({ sim }: { sim: Simulation }) {
  const { house, setHouse, isTestRunning } = sim;
  const [dbModels, setDbModels] = useState<DbHouseModel[]>([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);

  useEffect(() => {
    setLoadingModels(true);
    fetchHouseModels()
      .then((rows) => {
        if (rows.length > 0) setDbModels(rows);
      })
      .finally(() => setLoadingModels(false));
  }, []);

  const models = dbModels.length > 0
    ? dbModels.map((m) => ({ id: m.id, name: m.name, description: m.description ?? '', imageUrl: m.image_url ?? undefined, isActive: m.is_active }))
    : DEFAULT_HOUSE_MODELS;

  function selectModel(m: typeof models[0]) {
    setHouse((prev: HouseSelection) => ({
      ...prev,
      modelId: m.id,
      modelName: m.name,
      modelImageUrl: m.imageUrl ?? '',
    }));
    setModelOpen(false);
  }

  function setMat(field: keyof HouseSelection, value: string) {
    setHouse((prev: HouseSelection) => ({ ...prev, [field]: value }));
  }

  const isLocked = isTestRunning;

  return (
    <Panel
      title="House Model & Materials"
      icon={<Home className="h-4 w-4" />}
      right={
        isLocked ? (
          <span className="rounded-full bg-warn-500/15 px-2 py-0.5 text-[10px] font-bold text-warn-400">LOCKED DURING TEST</span>
        ) : house.modelName ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-ok-400">
            <CheckCircle2 className="h-3 w-3" /> {house.modelName}
          </span>
        ) : null
      }
    >
      <fieldset disabled={isLocked} className="space-y-4">
        {/* House Model Selector */}
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            House Model
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setModelOpen((o) => !o)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition ${
                house.modelName
                  ? 'border-accent-500/40 bg-accent-500/08 text-slate-200'
                  : 'border-base-600/70 bg-base-900/60 text-slate-400'
              } hover:border-accent-500/50 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span>{house.modelName || 'Select house model…'}</span>
              {loadingModels
                ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500" />
                : <ChevronDown className={`h-4 w-4 text-slate-400 transition ${modelOpen ? 'rotate-180' : ''}`} />
              }
            </button>
            {modelOpen && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-base-600/70 bg-base-800 shadow-panel">
                {models.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => selectModel(m)}
                      className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-base-700/60 ${
                        house.modelId === m.id ? 'bg-accent-500/10' : ''
                      }`}
                    >
                      <span className={`mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded border ${
                        house.modelId === m.id ? 'border-accent-500 bg-accent-500/20 text-accent-400' : 'border-base-600/70 text-transparent'
                      }`}>
                        <CheckCircle2 className="h-3 w-3" />
                      </span>
                      <span>
                        <span className={`block text-sm font-semibold ${house.modelId === m.id ? 'text-accent-400' : 'text-slate-200'}`}>{m.name}</span>
                        {m.description && <span className="block text-xs text-slate-500">{m.description}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Model image preview */}
          {house.modelImageUrl && (
            <div className="mt-2 overflow-hidden rounded-lg border border-base-600/70">
              <img src={house.modelImageUrl} alt={house.modelName} className="h-28 w-full object-cover" />
            </div>
          )}
          {house.modelName && !house.modelImageUrl && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-base-600/40 bg-base-900/40 px-3 py-2 text-xs text-slate-500">
              <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" />
              No image uploaded for this model. Upload via Supabase storage and set image_url in house_models.
            </div>
          )}
        </div>

        {/* Materials */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MaterialSelect
            label="Wall Material"
            options={WALL_MATERIALS}
            value={house.wallMaterial}
            onChange={(v) => setMat('wallMaterial', v)}
          />
          <MaterialSelect
            label="Roof Material"
            options={ROOF_MATERIALS}
            value={house.roofMaterial}
            onChange={(v) => setMat('roofMaterial', v)}
          />
          <MaterialSelect
            label="Floor Material"
            options={FLOOR_MATERIALS}
            value={house.floorMaterial}
            onChange={(v) => setMat('floorMaterial', v)}
          />
        </div>

        {/* Other materials */}
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Other / Custom Materials
          </label>
          <input
            type="text"
            placeholder="e.g. Steel frame, fiberglass insulation…"
            value={house.otherMaterials}
            onChange={(e) => setMat('otherMaterials', e.target.value)}
            className="w-full rounded-lg border border-base-600/70 bg-base-900/60 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-accent-500/50 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </fieldset>
    </Panel>
  );
}

function MaterialSelect({ label, options, value, onChange }: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value === value ? '' : o.value)}
            className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${
              value === o.value
                ? 'border-accent-500/40 bg-accent-500/15 text-accent-400'
                : 'border-base-600/70 bg-base-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
