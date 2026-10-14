import { ArrowUp, Monitor, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

/**
 * Work-order composer (wireframe input bar).
 * Height locked to --input-height (2rem). Submit wiring lands in a later slice.
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
          height: "var(--input-height)",
          minHeight: "var(--input-height)",
          maxHeight: "var(--input-height)",
          padding: "0 6px 0 10px",
          borderRadius: 999,
          background: "var(--panel-bg)",
          boxShadow: "var(--panel-shadow)",
          border: "1px solid var(--border-subtle)",
          boxSizing: "border-box",
        }}
      >
        <Plus
          aria-hidden
          size={16}
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
            height: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13,
            lineHeight: 1,
            padding: 0,
            minWidth: 0,
          }}
        />
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            height: "calc(var(--input-height) - 6px)",
            fontSize: 11,
            color: "var(--text-muted)",
            padding: "0 8px",
            borderRadius: 999,
            background: "var(--shell-bg)",
            flexShrink: 0,
          }}
        >
          <Monitor size={12} strokeWidth={1.75} aria-hidden />
          Gantry
        </span>
        <button
          type="submit"
          aria-label="Submit work order"
          style={{
            width: "calc(var(--input-height) - 6px)",
            height: "calc(var(--input-height) - 6px)",
            borderRadius: "50%",
            background: "var(--cta-primary-bg)",
            color: "var(--cta-primary-fg)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <ArrowUp size={14} strokeWidth={2.25} aria-hidden />
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
