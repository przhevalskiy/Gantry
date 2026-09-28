import {
  STORAGE_KEY,
  type ClientPortal,
  type PortalColor,
  type PortalKind,
  type PortalSwitchState,
} from './types';

function empty(): PortalSwitchState {
  return { version: 1, portals: [], settings: { pro: { enabled: false } } };
}

export function parsePortalUrl(
  url: string,
): { portalUrl: string; handle: string; kind: PortalKind } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    // QuickBooks Online — company id in path or query
    if (host === 'app.qbo.intuit.com' || host === 'qbo.intuit.com' || host.endsWith('.qbo.intuit.com')) {
      const pathId = u.pathname.match(/\/app\/([^/]+)/)?.[1];
      const queryId = u.searchParams.get('companyId') || u.searchParams.get('realmId');
      const handle = pathId || queryId || 'quickbooks';
      const portalUrl = pathId
        ? `https://app.qbo.intuit.com/app/${pathId}`
        : queryId
          ? `https://app.qbo.intuit.com/app/homepage?companyId=${queryId}`
          : 'https://app.qbo.intuit.com/';
      return { kind: 'quickbooks', handle, portalUrl };
    }

    // Xero
    if (host === 'go.xero.com' || host.endsWith('.xero.com')) {
      const org = u.pathname.match(/\/organisation\/([^/]+)/i)?.[1]
        || u.searchParams.get('organizationID')
        || u.searchParams.get('org')
        || host.split('.')[0]
        || 'xero';
      return {
        kind: 'xero',
        handle: org,
        portalUrl: u.origin + (u.pathname.startsWith('/app') ? u.pathname.split('/').slice(0, 3).join('/') : '/'),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function loadState(): Promise<PortalSwitchState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as PortalSwitchState | undefined;
  return stored?.version === 1 ? stored : empty();
}

export async function saveState(state: PortalSwitchState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function upsertPortal(input: {
  id?: string;
  label: string;
  portalUrl: string;
  color: PortalColor;
  notes?: string;
}): Promise<ClientPortal> {
  const parsed = parsePortalUrl(input.portalUrl);
  if (!parsed) throw new Error('Not a QuickBooks or Xero portal URL');
  const state = await loadState();
  const now = Date.now();
  if (input.id) {
    const existing = state.portals.find((p) => p.id === input.id);
    if (!existing) throw new Error('Portal not found');
    const next: ClientPortal = {
      ...existing,
      label: input.label.trim() || parsed.handle,
      portalUrl: parsed.portalUrl,
      handle: parsed.handle,
      kind: parsed.kind,
      color: input.color,
      notes: input.notes?.trim() ?? existing.notes,
    };
    state.portals = state.portals.map((p) => (p.id === next.id ? next : p));
    await saveState(state);
    return next;
  }
  const created: ClientPortal = {
    id: crypto.randomUUID(),
    label: input.label.trim() || parsed.handle,
    portalUrl: parsed.portalUrl,
    handle: parsed.handle,
    kind: parsed.kind,
    color: input.color,
    notes: input.notes?.trim() ?? '',
    createdAt: now,
    lastOpenedAt: 0,
  };
  state.portals.unshift(created);
  await saveState(state);
  return created;
}

export async function deletePortal(id: string): Promise<void> {
  const state = await loadState();
  state.portals = state.portals.filter((p) => p.id !== id);
  await saveState(state);
}

export async function touchOpened(id: string): Promise<void> {
  const state = await loadState();
  const p = state.portals.find((x) => x.id === id);
  if (!p) return;
  p.lastOpenedAt = Date.now();
  await saveState(state);
}
