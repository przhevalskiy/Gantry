import { useEffect, useState, type CSSProperties } from "react";
import { installPack, listPacks, updatePack } from "../services/gantry/client";
import { GantryApiError, type FirmPack } from "../services/gantry/types";

/** Firm packs catalog — GET/POST/PATCH /v1/packs. */
export function Practices() {
  const [packs, setPacks] = useState<FirmPack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyRef, setBusyRef] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setPacks(await listPacks());
    } catch (e) {
      setError(
        e instanceof GantryApiError
          ? e.detail
          : e instanceof Error
            ? e.message
            : "Failed to load practices",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onInstall(pack: FirmPack) {
    setBusyRef(pack.ref);
    setError(null);
    try {
      const row = await installPack(pack.ref);
      setPacks((prev) => prev.map((p) => (p.ref === pack.ref ? { ...p, ...row } : p)));
      await refresh();
    } catch (e) {
      setError(
        e instanceof GantryApiError
          ? e.detail
          : e instanceof Error
            ? e.message
            : "Install failed",
      );
    } finally {
      setBusyRef(null);
    }
  }

  async function onToggle(pack: FirmPack, enabled: boolean) {
    setBusyRef(pack.ref);
    setError(null);
    try {
      const row = await updatePack(pack.ref, { enabled });
      setPacks((prev) => prev.map((p) => (p.ref === pack.ref ? { ...p, ...row } : p)));
      await refresh();
    } catch (e) {
      setError(
        e instanceof GantryApiError
          ? e.detail
          : e instanceof Error
            ? e.message
            : "Update failed",
      );
    } finally {
      setBusyRef(null);
    }
  }

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
        Firm packs on retainer — enable a practice area, not a separately hosted agent.
      </p>
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
      ) : null}
      {error ? <p style={{ color: "#b45309", fontSize: 13 }}>{error}</p> : null}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 18 }}>
        {packs.map((p) => {
          const busy = busyRef === p.ref;
          return (
            <li
              key={p.ref}
              style={{ paddingBottom: 18, borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong style={{ fontSize: 16 }}>{p.label}</strong>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {p.enabled ? "enabled" : p.installed ? "installed" : "available"} · {p.ref}
                </span>
              </div>
              {p.description ? (
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "var(--text-secondary)",
                    fontSize: 14,
                    lineHeight: 1.45,
                  }}
                >
                  {p.description}
                </p>
              ) : null}
              {p.playbooks?.length ? (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                  Briefs: {p.playbooks.join(", ")}
                </p>
              ) : null}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {!p.installed ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onInstall(p)}
                    style={ctaStyle(busy)}
                  >
                    Put on retainer
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onToggle(p, !p.enabled)}
                    style={p.enabled ? secondaryStyle(busy) : ctaStyle(busy)}
                  >
                    {p.enabled ? "Disable" : "Enable"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ctaStyle(busy: boolean): CSSProperties {
  return {
    height: "var(--input-control-size)",
    padding: "0 12px",
    borderRadius: 10,
    background: "var(--cta-primary-bg)",
    color: "var(--cta-primary-fg)",
    fontSize: 13,
    fontWeight: 600,
    opacity: busy ? 0.55 : 1,
  };
}

function secondaryStyle(busy: boolean): CSSProperties {
  return {
    height: "var(--input-control-size)",
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid var(--border-subtle)",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: 13,
    fontWeight: 600,
    opacity: busy ? 0.55 : 1,
  };
}
