import type { PendingHitl } from "../../services/gantry/types";
import { HitlCard } from "./HitlCard";

/** Stack of pending partner approvals for one engagement. */
export function HitlPanel({
  taskId,
  pending,
  onResolved,
}: {
  taskId: string;
  pending: PendingHitl[];
  onResolved: (workflowId: string) => void;
}) {
  if (pending.length === 0) return null;

  return (
    <section style={{ marginBottom: 28, display: "grid", gap: 12 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 650,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Approvals
      </h2>
      {pending.map((p) => (
        <HitlCard
          key={p.workflow_id || p.checkpoint}
          taskId={taskId}
          pending={p}
          onResolved={onResolved}
        />
      ))}
    </section>
  );
}
