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
import { parseTargetUrl, upsertItem, deleteItem, loadState } from "./storage";

describe("hubspothop UAT CRUD", () => {
  it("UAT: parse + upsert + delete hubspot", async () => {
    expect(parseTargetUrl("https://app.hubspot.com/contacts/999/objects/0-1")?.handle).toBe("999");
    const created = await upsertItem({ label: "Acme CRM", url: "https://app.hubspot.com/contacts/999/objects/0-1", color: "mint" });
    expect(created.handle).toBe("999");
    await deleteItem(created.id);
    expect((await loadState()).items).toHaveLength(0);
  });
});
