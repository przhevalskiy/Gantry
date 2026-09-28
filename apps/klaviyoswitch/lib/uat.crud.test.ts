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

describe("klaviyoswitch UAT CRUD", () => {
  it("UAT: parse + upsert + delete klaviyo", async () => {
    expect(parseTargetUrl("https://www.klaviyo.com/dashboard")?.kind).toBe("klaviyo");
    const created = await upsertItem({ label: "Acme Email", url: "https://www.klaviyo.com/dashboard", color: "violet" });
    expect(created.kind).toBe("klaviyo");
    await deleteItem(created.id);
    expect((await loadState()).items).toHaveLength(0);
  });
});
