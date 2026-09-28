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
import { upsertMark, deleteMark, findMarkForUrl, listMarks } from "./storage";

describe("slackspacemark UAT CRUD", () => {
  it("UAT: upsert + match + delete mark", async () => {
    const created = await upsertMark({ label: "Acme Slack", urlMatch: "T0123ABC", color: "violet" });
    expect(created.label).toBeTruthy();
    const marks = await listMarks();
    expect(marks).toHaveLength(1);
    expect(findMarkForUrl(marks, "https://app.slack.com/client/T0123ABC")?.id).toBe(created.id);
    expect(findMarkForUrl(marks, "https://example.com/")).toBeUndefined();
    await deleteMark(created.id);
    expect(await listMarks()).toHaveLength(0);
  });
});
