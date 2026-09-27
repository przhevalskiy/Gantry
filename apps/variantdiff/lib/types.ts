export interface FieldSnapshot {
  key: string;
  label: string;
  value: string;
}

export interface ProductSnapshot {
  id: string;
  productLabel: string;
  url: string;
  capturedAt: number;
  fields: FieldSnapshot[];
}

export interface FieldDiff {
  key: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

export interface VariantDiffState {
  version: 1;
  baseline: ProductSnapshot | null;
  lastCompare: {
    at: number;
    productLabel: string;
    url: string;
    diffs: FieldDiff[];
  } | null;
  settings: { pro: { enabled: boolean } };
}

export const STORAGE_KEY = 'variantdiff_state_v1' as const;
