export type CheckSeverity = 'pass' | 'warn' | 'fail' | 'info';

export interface HealthCheck {
  id: string;
  label: string;
  severity: CheckSeverity;
  detail: string;
}

export interface StoreReport {
  id: string;
  storeLabel: string;
  url: string;
  checkedAt: number;
  checks: HealthCheck[];
  score: number;
}

export interface StorePulseState {
  version: 1;
  reports: StoreReport[];
  settings: { pro: { enabled: boolean } };
}

export const STORAGE_KEY = 'storepulse_state_v1' as const;
