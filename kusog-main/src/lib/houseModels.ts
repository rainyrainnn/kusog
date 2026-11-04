/*
 * House model and material configuration.
 * Edit the arrays below to change the available options in the UI.
 * Add new HOUSE_MODELS entries or change material lists freely.
 */

export type HouseModel = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  isActive: boolean;
};

export type MaterialOption = { label: string; value: string };

// ─── House Models ─────────────────────────────────────────────────────────────
// These seed values match what the database migration inserted.
// Actual images are set by updating the house_models.image_url column in Supabase.
// "id" here is a stable local key used before the DB fetch resolves.
export const DEFAULT_HOUSE_MODELS: HouseModel[] = [
  { id: 'model-a', name: 'Model A', description: 'Standard concrete house model with corrugated metal roof', isActive: true },
  { id: 'model-b', name: 'Model B', description: 'CHB block house model with galvanized iron roof', isActive: true },
  { id: 'model-c', name: 'Model C', description: 'Wooden frame house model with metal sheet roof', isActive: true },
  { id: 'custom',  name: 'Custom Model', description: 'Enter a custom model designation', isActive: true },
];

// ─── Material Options ─────────────────────────────────────────────────────────
// Edit these lists to reflect the actual materials available for testing.

export const WALL_MATERIALS: MaterialOption[] = [
  { label: 'Concrete',  value: 'Concrete' },
  { label: 'CHB',       value: 'CHB' },
  { label: 'Wood',      value: 'Wood' },
  { label: 'Plywood',   value: 'Plywood' },
  { label: 'Other',     value: 'Other' },
];

export const ROOF_MATERIALS: MaterialOption[] = [
  { label: 'Corrugated Metal', value: 'Corrugated Metal' },
  { label: 'Galvanized Iron',  value: 'Galvanized Iron' },
  { label: 'Metal Sheet',      value: 'Metal Sheet' },
  { label: 'Concrete',         value: 'Concrete' },
  { label: 'Other',            value: 'Other' },
];

export const FLOOR_MATERIALS: MaterialOption[] = [
  { label: 'Concrete', value: 'Concrete' },
  { label: 'Wood',     value: 'Wood' },
  { label: 'Tile',     value: 'Tile' },
  { label: 'Other',    value: 'Other' },
];
