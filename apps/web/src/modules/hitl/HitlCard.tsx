import { useState } from "react";
import { decideHitl } from "../../services/gantry/client";
import { GantryApiError, type PendingHitl } from "../../services/gantry/types";

/** Deterministic partner-approval card — REST only, not free-form chat (deep-dive HITL). */
export function HitlCard({
  taskId,
  pending,
  onResolved,
}: {
  taskId: string;
  pending: PendingHitl;
  onResolved: (workflowId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const needsNotes = pending.checkpoint === "pm_clarification";

  async function respond(approved: boolean) {
    setBusy(true);
    setError(null);
    try {
      const body =
        needsNotes || notes.trim()
          ? {
              checkpoint: pending.checkpoint,
              workflow_id: pending.workflow_id,
              approved,
              payload: {
                approved,
                notes: notes.trim() || undefined,
                answers: notes.trim() || undefined,
              },
            }
          : {
              checkpoint: pending.checkpoint,
              workflow_id: pending.workflow_id,
              approved,
            };
      await decideHitl(taskId, body);
      onResolved(pending.workflow_id);
    } catch (e) {
      const msg =
        e instanceof GantryApiError
          ? e.detail
          : e instanceof Error
            ? e.message
            : "Decision failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const title =
    pending.description || pending.action || `Checkpoint: ${pending.checkpoint}`;

  return (
    <div
      role="group"
      aria-label={`Approval ${pending.checkpoint}`}
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.72)",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            fontWeight: 650,
          }}
        >
          Partner approval
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
          {pending.checkpoint}
          {pending.questions?.length
            ? ` · ${pending.questions.length} question(s)`
            : ""}
        </p>
      </div>

      {pending.questions?.length ? (
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            color: "var(--text-secondary)",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {pending.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      ) : null}

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {needsNotes ? "Clarification (required for submit)" : "Notes (optional)"}
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          disabled={busy}
          style={{
            resize: "vertical",
            minHeight: 56,
            padding: "var(--input-padding-block) var(--input-padding-inline)",
            borderRadius: 10,
            border: "1px solid var(--border-subtle)",
            background: "rgba(255,255,255,0.9)",
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            color: "var(--text-primary)",
          }}
        />
      </label>

      {error ? (
        <p style={{ margin: 0, color: "#b45309", fontSize: 13 }}>{error}</p>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={busy || (needsNotes && !notes.trim())}
          onClick={() => void respond(true)}
          style={{
            height: "var(--input-control-size)",
            padding: "0 14px",
            borderRadius: 10,
            border: "none",
            background: "var(--cta-primary-bg)",
            color: "var(--cta-primary-fg)",
            fontWeight: 600,
            fontSize: 13,
            cursor: busy ? "wait" : "pointer",
            opacity: busy || (needsNotes && !notes.trim()) ? 0.55 : 1,
          }}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void respond(false)}
          style={{
            height: "var(--input-control-size)",
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "var(--text-primary)",
            fontWeight: 600,
            fontSize: 13,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.55 : 1,
          }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
