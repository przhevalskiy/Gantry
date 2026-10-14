import { useEffect, useRef } from "react";
import type { PendingHitl } from "../../services/gantry/types";
import { HitlCard } from "../hitl/HitlCard";
import {
  extractMessageText,
  isControlMessage,
  seatFromText,
  stripSeatPrefix,
} from "./messageText";
import type { StreamRow } from "./useTaskEventStream";

export type LocalBubble = {
  id: string;
  role: "user" | "firm" | "system";
  text: string;
  seat?: string | null;
};

/** Messaging thread — conversation first; HITL cards inline; not an ops log. */
export function MessageThread({
  taskId,
  goal,
  rows,
  pendingHitl,
  onHitlResolved,
  localBubbles,
  live,
}: {
  taskId: string;
  goal?: string | null;
  rows: StreamRow[];
  pendingHitl: PendingHitl[];
  onHitlResolved: (workflowId: string) => void;
  localBubbles: LocalBubble[];
  live: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  const bubbles: LocalBubble[] = [];
  if (goal) {
    bubbles.push({
      id: "goal",
      role: "user",
      text: goal,
    });
  }

  for (const row of rows) {
    const ev = row.event;
    if (ev.type === "message") {
      const text = extractMessageText(ev.message);
      if (!text || isControlMessage(text)) continue;
      const seat = seatFromText(text);
      bubbles.push({
        id: row.id,
        role: "firm",
        text: stripSeatPrefix(text),
        seat,
      });
    } else if (ev.type === "status") {
      bubbles.push({
        id: row.id,
        role: "system",
        text: `Status · ${ev.status.replace(/_/g, " ").toLowerCase()}`,
      });
    } else if (ev.type === "error") {
      bubbles.push({
        id: row.id,
        role: "system",
        text: ev.message,
      });
    } else if (ev.type === "done") {
      bubbles.push({
        id: row.id,
        role: "system",
        text: `Engagement ${ev.status.replace(/_/g, " ").toLowerCase()}`,
      });
    }
    // lifecycle + hitl: presence/cards handle these — skip log noise
  }

  for (const b of localBubbles) {
    if (!bubbles.some((x) => x.id === b.id)) bubbles.push(b);
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles.length, pendingHitl.length]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        padding: "8px 20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {bubbles.length === 0 && pendingHitl.length === 0 ? (
        <p style={{ margin: "24px auto", color: "var(--text-muted)", fontSize: 13 }}>
          {live ? "Foreman is staffing the floor…" : "No messages yet."}
        </p>
      ) : null}

      {bubbles.map((b) => (
        <Bubble key={b.id} bubble={b} />
      ))}

      {pendingHitl.map((p) => (
        <div key={p.workflow_id || p.checkpoint} style={{ maxWidth: 420, alignSelf: "stretch" }}>
          <HitlCard taskId={taskId} pending={p} onResolved={onHitlResolved} />
        </div>
      ))}

      <div ref={endRef} />
    </div>
  );
}

function Bubble({ bubble }: { bubble: LocalBubble }) {
  if (bubble.role === "system") {
    return (
      <p
        style={{
          margin: "4px auto",
          fontSize: 12,
          color: "var(--text-muted)",
          textAlign: "center",
          maxWidth: 420,
        }}
      >
        {bubble.text}
      </p>
    );
  }

  const mine = bubble.role === "user";
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "min(520px, 92%)",
        display: "grid",
        gap: 4,
      }}
    >
      {!mine && bubble.seat ? (
        <span
          style={{
            fontSize: 11,
            fontWeight: 650,
            color: "var(--text-muted)",
            paddingLeft: 4,
          }}
        >
          {bubble.seat}
        </span>
      ) : null}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: mine ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
          background: mine
            ? "var(--cta-primary-bg)"
            : "rgba(255,255,255,0.88)",
          color: mine ? "var(--cta-primary-fg)" : "var(--text-primary)",
          border: mine ? "none" : "1px solid var(--border-subtle)",
          fontSize: 14,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          boxShadow: mine ? "none" : "0 1px 2px rgba(40,30,70,0.04)",
        }}
      >
        {bubble.text}
      </div>
    </div>
  );
}
