import {
  BILLING_HINTS,
  STORAGE_KEY,
  type BillGuardState,
  type ClientGuard,
  type GuardColor,
} from './types';

function empty(): BillGuardState {
  return {
    version: 1,
    clients: [],
    settings: { enabled: true, requireTypedConfirm: false, pro: { enabled: false } },
  };
}

export async function loadState(): Promise<BillGuardState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as BillGuardState | undefined;
  return stored?.version === 1 ? stored : empty();
}

export async function saveState(state: BillGuardState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function listClients(): Promise<ClientGuard[]> {
  return (await loadState()).clients;
}

export async function upsertClient(input: {
  id?: string;
  urlMatch: string;
  label: string;
  color: GuardColor;
}): Promise<ClientGuard> {
  const state = await loadState();
  const urlMatch = input.urlMatch.trim();
  const label = input.label.trim();
  if (!urlMatch || !label) throw new Error('URL match and label required');

  if (input.id) {
    const existing = state.clients.find((c) => c.id === input.id);
    if (!existing) throw new Error('Client not found');
    const next: ClientGuard = {
      id: existing.id,
      createdAt: existing.createdAt,
      urlMatch,
      label,
      color: input.color,
    };
    state.clients = state.clients.map((c) => (c.id === next.id ? next : c));
    await saveState(state);
    return next;
  }

  const created: ClientGuard = {
    id: crypto.randomUUID(),
    urlMatch,
    label,
    color: input.color,
    createdAt: Date.now(),
  };
  state.clients.unshift(created);
  await saveState(state);
  return created;
}

export async function deleteClient(id: string): Promise<void> {
  const state = await loadState();
  state.clients = state.clients.filter((c) => c.id !== id);
  await saveState(state);
}

export function findClientForUrl(clients: ClientGuard[], url: string): ClientGuard | undefined {
  const lower = url.toLowerCase();
  return clients.find((c) => lower.includes(c.urlMatch.toLowerCase()));
}

export function isBillingUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return BILLING_HINTS.some((h) => lower.includes(h));
}
