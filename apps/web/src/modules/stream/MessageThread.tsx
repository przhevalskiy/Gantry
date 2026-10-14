import { useEffect, useRef } from "react";
import type { PendingHitl } from "../../services/gantry/types";
import { HitlCard } from "../hitl/HitlCard";
import { EngagementStory } from "./EngagementStory";
import { synthesizeStory } from "./synthesizeStory";
import { TrackBoard } from "./TrackBoard";
import type { StreamRow } from "./useTaskEventStream";

export type LocalBubble = {
  id: string;
  role: "user" | "firm" | "system";
  text: string;
  seat?: string | null;
};

/** Messaging thread: your ask → synthesized firm story → chains → HITL. */
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
  terminal?: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  const items = synthesizeStory(
    rows,
    goal,
    localBubbles.filter((b) => b.role === "user").map((b) => ({ id: b.id, text: b.text })),
    pendingHitl.length > 0,
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, pendingHitl.length, rows.length]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        padding: "8px 20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {items.length === 0 && pendingHitl.length === 0 ? (
        <p style={{ margin: "24px auto", color: "var(--text-muted)", fontSize: 13 }}>
          {live ? "Foreman is staffing the engagement…" : "No activity yet."}
        </p>
      ) : null}

      {items.map((item) => {
        if (item.kind === "user") {
          return <UserBubble key={item.id} text={item.text} />;
        }
        if (item.kind === "system") {
          return (
            <p
              key={item.id}
              style={{
                margin: "4px auto",
                fontSize: 12,
                color: "var(--text-muted)",
                textAlign: "center",
              }}
            >
              {item.text}
            </p>
          );
        }
        if (item.kind === "story") {
          return (
            <EngagementStory
              key={item.id}
              beats={item.beats}
              waitingOnYou={item.waitingOnYou}
            />
          );
        }
        return <TrackBoard key={item.id} tracks={item.tracks} />;
      })}

      {pendingHitl.map((p) => (
        <div
          key={p.workflow_id || p.checkpoint}
          style={{ maxWidth: "min(600px, 100%)", alignSelf: "stretch" }}
        >
          <HitlCard taskId={taskId} pending={p} onResolved={onHitlResolved} />
        </div>
      ))}

      <div ref={endRef} />
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div
      style={{
        alignSelf: "flex-end",
        maxWidth: "min(520px, 92%)",
        padding: "10px 14px",
        borderRadius: "18px 18px 6px 18px",
        background: "var(--cta-primary-bg)",
        color: "var(--cta-primary-fg)",
        fontSize: 14,
        lineHeight: 1.45,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {text}
    </div>
  );
}
