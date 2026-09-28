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
import { parseShopifyAdmin, upsertStore, deleteStore, loadState } from "./storage";

describe("shopswitch UAT CRUD", () => {
  it("UAT: parse + upsert + delete store", async () => {
    const parsed = parseShopifyAdmin("https://admin.shopify.com/store/acme-co/products");
    expect(parsed?.handle).toBe("acme-co");
    const created = await upsertStore({ label: "Acme", adminUrl: "https://admin.shopify.com/store/acme-co", color: "mint" });
    expect(created.handle).toBe("acme-co");
    expect((await loadState()).stores).toHaveLength(1);
    await deleteStore(created.id);
    expect((await loadState()).stores).toHaveLength(0);
  });
});
