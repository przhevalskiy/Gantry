import { useState } from "react";
import { getApiKey, setApiKey } from "../../services/gantry/auth";

/** Bearer key field — used from sidebar settings, not the compose hero. */
export function ApiKeyField({
  compact = false,
  onSaved,
}: {
  compact?: boolean;
  onSaved?: () => void;
}) {
  const [value, setValue] = useState(() => getApiKey() ?? "");
  const [saved, setSaved] = useState(false);

  function persist() {
    setApiKey(value.trim() || null);
    setSaved(true);
    onSaved?.();
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div
      style={{
        width: compact ? "100%" : "min(720px, 100%)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <input
        className="input-bar"
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={persist}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            persist();
          }
        }}
        placeholder="gantry_…"
        aria-label="Gantry API key"
        style={{
          flex: 1,
          height: "auto",
          maxHeight: "none",
          borderRadius: 10,
          border: "1px solid var(--border-subtle)",
          background: compact ? "rgba(243,240,248,0.9)" : "var(--panel-bg)",
          padding: "0.4rem 0.75rem",
          fontSize: 13,
        }}
      />
      {saved ? (
        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>Saved</span>
      ) : null}
    </div>
  );
}
