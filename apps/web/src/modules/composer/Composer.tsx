import { ArrowUp, LoaderCircle, Monitor, Plus } from "lucide-react";
import { type FormEvent } from "react";

/**
 * Work-order composer. Parent handles POST /v1/tasks (P1).
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  submitting = false,
  error = null,
  placeholder = "File a work order or type / for more",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (goal: string) => void;
  disabled?: boolean;
  submitting?: boolean;
  error?: string | null;
  placeholder?: string;
}) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const goal = value.trim();
    if (!goal || disabled || submitting) return;
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
          opacity: disabled ? 0.7 : 1,
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
          disabled={disabled || submitting}
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
          disabled={disabled || submitting || !value.trim()}
          style={{
            width: "var(--input-control-size)",
            height: "var(--input-control-size)",
            borderRadius: "50%",
            background: "var(--cta-primary-bg)",
            color: "var(--cta-primary-fg)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            opacity: disabled || submitting || !value.trim() ? 0.45 : 1,
          }}
        >
          {submitting ? (
            <LoaderCircle size={16} strokeWidth={2.25} className="spin" aria-hidden />
          ) : (
            <ArrowUp size={16} strokeWidth={2.25} aria-hidden />
          )}
        </button>
      </div>
      {error ? (
        <p
          style={{
            margin: "10px 4px 0",
            fontSize: 12,
            color: "#b45309",
            textAlign: "center",
          }}
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
