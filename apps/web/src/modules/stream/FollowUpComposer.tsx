import { ArrowUp, LoaderCircle } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { sendFollowup } from "../../services/gantry/client";
import { GantryApiError } from "../../services/gantry/types";

/** Bottom chat bar — POST /v1/tasks/{id}/followup into the live engagement. */
export function FollowUpComposer({
  taskId,
  disabled,
  onSent,
}: {
  taskId: string;
  disabled?: boolean;
  onSent: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = value.trim();
    if (!text || busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      await sendFollowup(taskId, text);
      onSent(text);
      setValue("");
    } catch (err) {
      setError(
        err instanceof GantryApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Send failed",
      );
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      style={{
        padding: "10px 16px 14px",
        borderTop: "1px solid var(--border-subtle)",
        background: "rgba(255,255,255,0.55)",
      }}
    >
      <div
        className="input-bar"
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          borderRadius: 22,
          background: "var(--panel-bg)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--panel-shadow)",
          paddingBlock: 8,
        }}
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={busy || disabled}
          placeholder={disabled ? "Engagement closed" : "Message the firm…"}
          aria-label="Follow-up message"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            resize: "none",
            background: "transparent",
            fontSize: 14,
            lineHeight: 1.4,
            padding: "6px 0",
            minHeight: 28,
            maxHeight: 96,
            fontFamily: "var(--font-sans)",
          }}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={busy || disabled || !value.trim()}
          style={{
            width: "var(--input-control-size)",
            height: "var(--input-control-size)",
            borderRadius: "50%",
            background: "var(--cta-primary-bg)",
            color: "var(--cta-primary-fg)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            opacity: busy || disabled || !value.trim() ? 0.4 : 1,
          }}
        >
          {busy ? (
            <LoaderCircle size={16} strokeWidth={2.25} className="spin" aria-hidden />
          ) : (
            <ArrowUp size={16} strokeWidth={2.25} aria-hidden />
          )}
        </button>
      </div>
      {error ? (
        <p style={{ margin: "8px 4px 0", fontSize: 12, color: "#b45309" }}>{error}</p>
      ) : null}
    </form>
  );
}
