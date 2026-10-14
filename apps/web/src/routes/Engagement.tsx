import { Link, useLocation, useParams } from "react-router-dom";
import { paths } from "../lib/paths";
import { ArtifactClimax } from "../modules/artifacts";
import { EngagementFloor } from "../modules/engagement-floor";
import { HitlPanel } from "../modules/hitl";
import { StreamTimeline, useTaskEventStream } from "../modules/stream";

/** Active matter — floor + SSE + HITL + artifact climax. */
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

  const displayStatus = status ?? task?.status ?? null;
  const displayResult = result !== undefined ? result : task?.result;
  const goal = task?.goal || navState.goal;
  const projectId = task?.project_id || navState.project_id;

  return (
    <div style={{ padding: "48px 32px 32px", maxWidth: 800 }}>
      <p style={{ margin: "0 0 8px", fontSize: 13 }}>
        <Link to={paths.runs} style={{ color: "var(--text-muted)" }}>
          Runs
        </Link>
        <span style={{ color: "var(--text-muted)" }}> / </span>
        <span style={{ color: "var(--text-secondary)" }}>{taskId}</span>
      </p>
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: 28,
          fontWeight: 650,
          letterSpacing: "-0.02em",
        }}
      >
        Engagement
      </h1>
      <p style={{ margin: "0 0 20px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        Staffed floor, live stream, partner approvals
        {live ? (
          <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: 12 }}>
            · live
          </span>
        ) : null}
        .
      </p>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
      ) : null}
      {streamError ? (
        <p style={{ color: "#b45309", fontSize: 13, marginBottom: 16 }}>{streamError}</p>
      ) : null}

      <EngagementFloor status={displayStatus} pendingHitl={pendingHitl} />

      <section style={{ marginBottom: 28 }}>
        <dl
          style={{
            margin: 0,
            display: "grid",
            gap: 12,
            fontSize: 14,
          }}
        >
          {displayStatus ? (
            <div>
              <dt
                style={{
                  color: "var(--text-muted)",
                  fontSize: 11,
                  textTransform: "uppercase",
                }}
              >
                Status
              </dt>
              <dd style={{ margin: "2px 0 0", fontWeight: 600 }}>{displayStatus}</dd>
            </div>
          ) : null}
          {goal ? (
            <div>
              <dt
                style={{
                  color: "var(--text-muted)",
                  fontSize: 11,
                  textTransform: "uppercase",
                }}
              >
                Goal
              </dt>
              <dd style={{ margin: "2px 0 0" }}>{goal}</dd>
            </div>
          ) : null}
          {projectId ? (
            <div>
              <dt
                style={{
                  color: "var(--text-muted)",
                  fontSize: 11,
                  textTransform: "uppercase",
                }}
              >
                Project
              </dt>
              <dd style={{ margin: "2px 0 0" }}>{projectId}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {taskId ? (
        <HitlPanel
          taskId={taskId}
          pending={pendingHitl}
          onResolved={dismissHitl}
        />
      ) : null}

      <section style={{ marginBottom: 28 }}>
        <h2
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 650,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Stream
        </h2>
        <StreamTimeline rows={rows} live={live} />
      </section>

      {displayResult ? <ArtifactClimax result={displayResult} /> : null}
    </div>
  );
}
