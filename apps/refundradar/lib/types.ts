export type SignalSeverity = 'ok' | 'watch' | 'spike' | 'info';

export interface RadarSignal {
  id: string;
  label: string;
  severity: SignalSeverity;
  detail: string;
  count?: number;
}

export interface RadarScan {
  id: string;
  storeLabel: string;
  url: string;
  scannedAt: number;
  signals: RadarSignal[];
  spikeScore: number;
}

export interface RefundRadarState {
  version: 1;
  scans: RadarScan[];
  settings: {
    /** Counts at or above this are treated as spikes when visible on the page */
    spikeThreshold: number;
    pro: { enabled: boolean };
  };
}

export const STORAGE_KEY = 'refundradar_state_v1' as const;
