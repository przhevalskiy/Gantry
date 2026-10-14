import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { paths } from "../lib/paths";
import { ArtifactClimax } from "../modules/artifacts";
import { EngagementFloor } from "../modules/engagement-floor";
import {
  FollowUpComposer,
  MessageThread,
  useTaskEventStream,
  type LocalBubble,
} from "../modules/stream";
import { derivePhaseView } from "../modules/stream/engagementPhase";

/** Messaging-first engagement — one phase drives header, story, chains, artifact. */
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

  const phase = useMemo(
    () =>
      derivePhaseView({
        status: displayStatus,
        pendingHitl,
        result: displayResult,
        rows,
      }),
    [displayStatus, pendingHitl, displayResult, rows],
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
        height: "100%",
        maxHeight: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
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
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 4px", fontSize: 12 }}>
            <Link to={paths.runs} style={{ color: "var(--text-muted)" }}>
              Runs
            </Link>
            <span style={{ color: "var(--text-muted)" }}> · </span>
            <span style={{ color: "var(--text-muted)" }}>
              {phase.label}
              {live && !phase.terminal ? " · live" : ""}
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
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            {phase.caption}
          </p>
        </div>
        <EngagementFloor
          status={displayStatus}
          pendingHitl={pendingHitl}
          compact
          captionOverride={null}
        />
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <p
            style={{
              margin: "12px 20px 0",
              color: "var(--text-muted)",
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            Opening engagement…
          </p>
        ) : null}
        {streamError ? (
          <p
            style={{
              margin: "8px 20px 0",
              color: "#b45309",
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {streamError}
          </p>
        ) : null}

        <MessageThread
          taskId={taskId}
          goal={goal}
          rows={rows}
          pendingHitl={pendingHitl}
          onHitlResolved={dismissHitl}
          localBubbles={localBubbles}
          live={live}
          status={displayStatus}
          result={displayResult}
          deliverable={
            phase.showDeliverable && displayResult ? (
              <ArtifactClimax result={displayResult} />
            ) : null
          }
        />
      </div>

      <div style={{ flexShrink: 0 }}>
        <FollowUpComposer
          taskId={taskId}
          disabled={phase.terminal}
          onSent={(text) =>
            setLocalBubbles((prev) => [
              ...prev,
              { id: `local-${Date.now()}`, role: "user", text },
            ])
          }
        />
      </div>
    </div>
  );
}
