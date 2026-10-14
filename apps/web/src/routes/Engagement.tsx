import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { formatStatus } from "../lib/format";
import { paths } from "../lib/paths";
import { ArtifactClimax } from "../modules/artifacts";
import { EngagementFloor } from "../modules/engagement-floor";
import {
  FollowUpComposer,
  MessageThread,
  useTaskEventStream,
  type LocalBubble,
} from "../modules/stream";

/**
 * Messaging-first engagement — chat with the firm, floor as presence,
 * HITL cards inline, artifact climax (not an ops console).
 */
export function Engagement() {
  const { taskId } = useParams();
  const location = useLocation();
  const navState = (location.state || {}) as { goal?: string; project_id?: string };
  const {
    task,
    rows,
    status,
    result,
    pendingHitl,
    dismissHitl,
    streamError,
    loading,
    live,
  } = useTaskEventStream(taskId);

  const [localBubbles, setLocalBubbles] = useState<LocalBubble[]>([]);

  const displayStatus = status ?? task?.status ?? null;
  const displayResult = result !== undefined ? result : task?.result;
  const goal = task?.goal || navState.goal;
  const terminal = ["completed", "failed", "cancelled", "terminated", "timeout"].includes(
    (displayStatus || "").toLowerCase(),
  );

  if (!taskId) {
    return (
      <div style={{ padding: 32 }}>
        <Link to={paths.runs}>Back to runs</Link>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <header
        style={{
          padding: "16px 20px 12px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "grid",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 4px", fontSize: 12 }}>
              <Link to={paths.runs} style={{ color: "var(--text-muted)" }}>
                Runs
              </Link>
              <span style={{ color: "var(--text-muted)" }}> · </span>
              <span style={{ color: "var(--text-muted)" }}>
                {formatStatus(displayStatus)}
                {live ? " · live" : ""}
              </span>
            </p>
            <h1
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 650,
                letterSpacing: "-0.02em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {goal || "Engagement"}
            </h1>
          </div>
        </div>
        <EngagementFloor
          status={displayStatus}
          pendingHitl={pendingHitl}
          compact
        />
      </header>

      {loading ? (
        <p style={{ margin: "16px 20px", color: "var(--text-muted)", fontSize: 13 }}>
          Opening engagement…
        </p>
      ) : null}
      {streamError ? (
        <p style={{ margin: "8px 20px", color: "#b45309", fontSize: 13 }}>{streamError}</p>
      ) : null}

      <MessageThread
        taskId={taskId}
        goal={goal}
        rows={rows}
        pendingHitl={pendingHitl}
        onHitlResolved={dismissHitl}
        localBubbles={localBubbles}
        live={live}
        terminal={terminal}
      />

      {displayResult ? (
        <div style={{ padding: "0 20px 12px", flexShrink: 0 }}>
          <ArtifactClimax result={displayResult} />
        </div>
      ) : null}

      <FollowUpComposer
        taskId={taskId}
        disabled={terminal}
        onSent={(text) =>
          setLocalBubbles((prev) => [
            ...prev,
            { id: `local-${Date.now()}`, role: "user", text },
          ])
        }
      />
    </div>
  );
}
