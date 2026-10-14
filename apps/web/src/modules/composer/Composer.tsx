import { useState, type FormEvent } from "react";

/**
 * Work-order composer (wireframe input bar).
 * Submit wiring lands in a later slice — scaffold captures goal only.
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
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: varComposer(),
          padding: "10px 14px",
          borderRadius: 20,
          background: "var(--panel-bg)",
          boxShadow: "var(--panel-shadow)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <span aria-hidden style={{ color: "var(--text-muted)", fontSize: 18 }}>
          +
        </span>
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
            padding: "8px 0",
          }}
        />
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            padding: "4px 8px",
            borderRadius: 8,
            background: "var(--shell-bg)",
          }}
        >
          Gantry
        </span>
        <button
          type="submit"
          aria-label="Submit work order"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--cta-primary-bg)",
            color: "var(--cta-primary-fg)",
            display: "grid",
            placeItems: "center",
            fontSize: 16,
          }}
        >
          ↑
        </button>
      </div>
      {hint ? (
        <p style={{ margin: "10px 4px 0", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          {hint}
        </p>
      ) : null}
    </form>
  );
}

function varComposer() {
  return "var(--composer-height)";
}
