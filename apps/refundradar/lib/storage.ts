import { STORAGE_KEY, type RadarScan, type RefundRadarState } from './types';

function empty(): RefundRadarState {
  return {
    version: 1,
    scans: [],
    settings: { spikeThreshold: 5, pro: { enabled: false } },
  };
}

export async function loadState(): Promise<RefundRadarState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as RefundRadarState | undefined;
  return stored?.version === 1 ? stored : empty();
}

export async function saveState(state: RefundRadarState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function listScans(): Promise<RadarScan[]> {
  return (await loadState()).scans;
}

export async function saveScan(scan: RadarScan): Promise<void> {
  const state = await loadState();
  state.scans = [scan, ...state.scans].slice(0, 20);
  await saveState(state);
}

export async function clearScans(): Promise<void> {
  const state = await loadState();
  state.scans = [];
  await saveState(state);
}

export async function setSpikeThreshold(n: number): Promise<void> {
  const state = await loadState();
  state.settings.spikeThreshold = Math.max(1, Math.min(50, Math.round(n)));
  await saveState(state);
}

export function formatOpsNote(scan: RadarScan): string {
  const lines = [
    `RefundRadar — ${scan.storeLabel}`,
    `URL: ${scan.url}`,
    `Scanned: ${new Date(scan.scannedAt).toISOString()}`,
    `Spike score: ${scan.spikeScore}/100`,
    '',
    ...scan.signals.map((s) => `- [${s.severity.toUpperCase()}] ${s.label}: ${s.detail}`),
  ];
  return lines.join('\n');
}
