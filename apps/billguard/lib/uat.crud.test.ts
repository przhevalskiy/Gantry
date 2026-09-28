import { beforeEach, describe, expect, it, vi } from "vitest";

const store: Record<string, unknown> = {};

vi.stubGlobal("browser", {
  storage: {
    local: {
      async get(key: string | string[] | null) {
        if (key == null) return { ...store };
        if (typeof key === "string") return { [key]: store[key] };
        const out: Record<string, unknown> = {};
        for (const k of key) out[k] = store[k];
        return out;
      },
      async set(obj: Record<string, unknown>) {
        Object.assign(store, obj);
      },
    },
  },
});

vi.stubGlobal("crypto", {
  randomUUID: () => "uat-id-" + Math.random().toString(16).slice(2),
});

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

import { upsertClient, deleteClient, findClientForUrl, isBillingUrl, listClients } from "./storage";

describe("billguard UAT CRUD", () => {
  it("UAT: client CRUD + billing URL detection", async () => {
    expect(isBillingUrl("https://ads.google.com/aw/billing")).toBe(true);
    expect(isBillingUrl("https://ads.google.com/aw/overview")).toBe(false);
    const created = await upsertClient({ label: "Acme Ads", urlMatch: "act=999", color: "coral" });
    const clients = await listClients();
    expect(findClientForUrl(clients, "https://adsmanager.facebook.com/billing?act=999")?.label).toBe("Acme Ads");
    await deleteClient(created.id);
    expect(await listClients()).toHaveLength(0);
  });
});
