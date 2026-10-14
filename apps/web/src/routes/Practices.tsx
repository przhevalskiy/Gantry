import { useEffect, useState } from "react";
import { listPacks } from "../services/gantry/client";
import { GantryApiError, type FirmPack } from "../services/gantry/types";

/** Firm packs catalog (practices on retainer) — GET /v1/packs. */
export function Practices() {
  const [packs, setPacks] = useState<FirmPack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void listPacks()
      .then((rows) => {
        if (!cancelled) setPacks(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof GantryApiError
            ? e.detail
            : e instanceof Error
              ? e.message
              : "Failed to load practices",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: "48px 32px 32px", maxWidth: 720 }}>
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: 28,
          fontWeight: 650,
          letterSpacing: "-0.02em",
        }}
      >
        Practices
      </h1>
      <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        Firm packs on retainer — practices you enable, not separately hosted agents.
      </p>
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
      ) : null}
      {error ? <p style={{ color: "#b45309", fontSize: 13 }}>{error}</p> : null}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 18 }}>
        {packs.map((p) => (
          <li key={p.ref} style={{ paddingBottom: 18, borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <strong style={{ fontSize: 16 }}>{p.label}</strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {p.enabled ? "enabled" : "available"} · {p.ref}
              </span>
            </div>
            {p.description ? (
              <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.45 }}>
                {p.description}
              </p>
            ) : null}
            {p.playbooks?.length ? (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Briefs: {p.playbooks.join(", ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
