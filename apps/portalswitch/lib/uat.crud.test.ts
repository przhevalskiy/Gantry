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
import { parsePortalUrl, upsertPortal, deletePortal, loadState } from "./storage";

describe("portalswitch UAT CRUD", () => {
  it("UAT: parse + upsert + delete portal", async () => {
    expect(parsePortalUrl("https://app.qbo.intuit.com/app/homepage")?.kind).toBe("quickbooks");
    const created = await upsertPortal({ label: "Acme Books", portalUrl: "https://app.qbo.intuit.com/app/homepage", color: "sky" });
    expect(created.kind).toBe("quickbooks");
    expect((await loadState()).portals).toHaveLength(1);
    await deletePortal(created.id);
    expect((await loadState()).portals).toHaveLength(0);
  });
});
