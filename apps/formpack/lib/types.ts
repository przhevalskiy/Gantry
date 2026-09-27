export type PackNiche = 'shipping' | 'grant' | 'admin' | 'custom';

export interface FormField {
  /** CSS selector or input name/id/placeholder hint */
  key: string;
  value: string;
}

export interface FormProfile {
  id: string;
  name: string;
  niche: PackNiche;
  fields: FormField[];
  createdAt: number;
  updatedAt: number;
}

export interface FormPackState {
  version: 1;
  profiles: FormProfile[];
  settings: { pro: { enabled: boolean } };
}

export const STORAGE_KEY = 'formpack_state_v1' as const;
