import { STORAGE_KEY, type ShopStore, type ShopSwitchState, type StoreColor } from './types';

function empty(): ShopSwitchState {
  return { version: 1, stores: [], settings: { pro: { enabled: false } } };
}

export function parseShopifyAdmin(url: string): { adminUrl: string; handle: string } | null {
  try {
    const u = new URL(url);
    // https://admin.shopify.com/store/<handle>/...
    const m = u.pathname.match(/\/store\/([^/]+)/);
    if (u.hostname === 'admin.shopify.com' && m?.[1]) {
      const handle = m[1];
      return {
        handle,
        adminUrl: `https://admin.shopify.com/store/${handle}`,
      };
    }
    // https://<handle>.myshopify.com/admin...
    const shop = u.hostname.match(/^([a-z0-9-]+)\.myshopify\.com$/i);
    if (shop?.[1]) {
      const handle = shop[1];
      return {
        handle,
        adminUrl: `https://${handle}.myshopify.com/admin`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function loadState(): Promise<ShopSwitchState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as ShopSwitchState | undefined;
  return stored?.version === 1 ? stored : empty();
}

export async function saveState(state: ShopSwitchState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function upsertStore(input: {
  id?: string;
  label: string;
  adminUrl: string;
  color: StoreColor;
  notes?: string;
}): Promise<ShopStore> {
  const parsed = parseShopifyAdmin(input.adminUrl);
  if (!parsed) throw new Error('Not a Shopify admin URL');
  const state = await loadState();
  const now = Date.now();
  if (input.id) {
    const existing = state.stores.find((s) => s.id === input.id);
    if (!existing) throw new Error('Store not found');
    const next: ShopStore = {
      ...existing,
      label: input.label.trim() || parsed.handle,
      adminUrl: parsed.adminUrl,
      handle: parsed.handle,
      color: input.color,
      notes: input.notes?.trim() ?? existing.notes,
    };
    state.stores = state.stores.map((s) => (s.id === next.id ? next : s));
    await saveState(state);
    return next;
  }
  const created: ShopStore = {
    id: crypto.randomUUID(),
    label: input.label.trim() || parsed.handle,
    adminUrl: parsed.adminUrl,
    handle: parsed.handle,
    color: input.color,
    notes: input.notes?.trim() ?? '',
    createdAt: now,
    lastOpenedAt: 0,
  };
  state.stores.unshift(created);
  await saveState(state);
  return created;
}

export async function deleteStore(id: string): Promise<void> {
  const state = await loadState();
  state.stores = state.stores.filter((s) => s.id !== id);
  await saveState(state);
}

export async function touchOpened(id: string): Promise<void> {
  const state = await loadState();
  const s = state.stores.find((x) => x.id === id);
  if (!s) return;
  s.lastOpenedAt = Date.now();
  await saveState(state);
}
