import { KeyRound } from "lucide-react";
import { useState } from "react";
import { getApiKey, setApiKey } from "../../services/gantry/auth";

/** Optional Bearer key. Local API may use GANTRY_DEV_AUTH_BYPASS without a key. */
export function ApiKeyField() {
  const [value, setValue] = useState(() => getApiKey() ?? "");
  const [saved, setSaved] = useState(false);

  function persist() {
    setApiKey(value.trim() || null);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div
      style={{
        width: "min(720px, 100%)",
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <KeyRound size={14} strokeWidth={1.75} aria-hidden style={{ color: "var(--text-muted)" }} />
      <input
        className="input-bar"
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={persist}
        placeholder="API key (optional if API auth bypass)"
        aria-label="Gantry API key"
        style={{
          flex: 1,
          height: "auto",
          maxHeight: "none",
          borderRadius: 999,
          border: "1px solid var(--border-subtle)",
          background: "var(--panel-bg)",
          padding: "0.4rem 0.875rem",
          fontSize: 13,
        }}
      />
      {saved ? (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Saved</span>
      ) : null}
    </div>
  );
}
