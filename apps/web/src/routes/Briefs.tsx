import { useEffect, useState } from "react";
import { listPlaybooks } from "../services/gantry/client";
import { GantryApiError, type PlaybookBrief } from "../services/gantry/types";

/** Engagement briefs (playbooks) — GET /v1/playbooks. */
export function Briefs() {
  const [briefs, setBriefs] = useState<PlaybookBrief[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void listPlaybooks()
      .then((rows) => {
        if (!cancelled) setBriefs(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof GantryApiError
            ? e.detail
            : e instanceof Error
              ? e.message
              : "Failed to load briefs",
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
        Briefs
      </h1>
      <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        Engagement briefs — seats, stages, and artifact policy for a work order.
      </p>
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
      ) : null}
      {error ? <p style={{ color: "#b45309", fontSize: 13 }}>{error}</p> : null}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 18 }}>
        {briefs.map((b) => {
          const vertical =
            b.config && typeof b.config.vertical === "string"
              ? b.config.vertical
              : null;
          return (
            <li
              key={b.id}
              style={{ paddingBottom: 18, borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong style={{ fontSize: 16 }}>{b.label}</strong>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {b.is_system ? "system" : "org"}
                  {vertical ? ` · ${vertical}` : ""}
                </span>
              </div>
              {b.description ? (
                <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                  {b.description}
                </p>
              ) : null}
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                {b.slug || b.id}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
