import { ArrowUp, Monitor, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

/**
 * Work-order composer (wireframe input bar).
 * Inline padding locked to 2rem; vertical padding restored for chrome.
 * Submit wiring lands in a later slice.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder = "File a work order or type / for more",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (goal: string) => void;
  placeholder?: string;
}) {
  const [hint, setHint] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const goal = value.trim();
    if (!goal) return;
    setHint("Scaffold only — POST /v1/tasks wiring comes in the next slice.");
    onSubmit(goal);
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: "min(720px, 100%)" }}>
      <div
        className="input-bar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderRadius: 999,
          background: "var(--panel-bg)",
          boxShadow: "var(--panel-shadow)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <Plus
          aria-hidden
          size={18}
          strokeWidth={1.75}
          style={{ flexShrink: 0, color: "var(--text-muted)" }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Work order goal"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 15,
            lineHeight: 1.4,
            padding: 0,
            minWidth: 0,
            height: "auto",
          }}
        />
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: "var(--input-control-size)",
            fontSize: 12,
            color: "var(--text-muted)",
            padding: "0 10px",
            borderRadius: 999,
            background: "var(--shell-bg)",
            flexShrink: 0,
          }}
        >
          <Monitor size={14} strokeWidth={1.75} aria-hidden />
          Gantry
        </span>
        <button
          type="submit"
          aria-label="Submit work order"
          style={{
            width: "var(--input-control-size)",
            height: "var(--input-control-size)",
            borderRadius: "50%",
            background: "var(--cta-primary-bg)",
            color: "var(--cta-primary-fg)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <ArrowUp size={16} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      {hint ? (
        <p
          style={{
            margin: "10px 4px 0",
            fontSize: 12,
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          {hint}
        </p>
      ) : null}
    </form>
  );
}
