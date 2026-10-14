import { KeyRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiKeyField } from "../modules/auth/ApiKeyField";
import { hasApiKey } from "../services/gantry/auth";

/** Sidebar identity + settings (API key lives here, not in the compose hero). */
export function UserChip() {
  const [open, setOpen] = useState(false);
  const [keyed, setKeyed] = useState(() => hasApiKey());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {open ? (
        <div
          role="dialog"
          aria-label="Client settings"
          style={{
            position: "absolute",
            left: 10,
            right: 10,
            bottom: "100%",
            marginBottom: 8,
            padding: 12,
            borderRadius: 14,
            background: "var(--panel-bg)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--panel-shadow)",
            zIndex: 40,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              fontWeight: 650,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            API key
          </p>
          <ApiKeyField
            compact
            onSaved={() => {
              setKeyed(hasApiKey());
            }}
          />
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
            Optional when the API runs with auth bypass. Stored only in this browser.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Client settings"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderTop: "1px solid var(--sidebar-border)",
          textAlign: "left",
          background: open ? "rgba(139, 124, 246, 0.08)" : "transparent",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--accent-400), var(--accent-600))",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            display: "grid",
            placeItems: "center",
          }}
        >
          G
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Gantry</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {keyed ? "Key saved" : "Firm client · set key"}
          </div>
        </div>
        <KeyRound size={14} strokeWidth={1.75} aria-hidden style={{ color: "var(--text-muted)" }} />
      </button>
    </div>
  );
}
