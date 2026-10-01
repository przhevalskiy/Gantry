export const STORAGE_KEY_LAST = 'trackerglance_last_v1' as const;

export interface GlanceScan {
  url: string;
  title: string;
  at: number;
  hits: { id: string; label: string; category: string; evidence: string }[];
}
