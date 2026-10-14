import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { paths } from "../lib/paths";
import { getTask } from "../services/gantry/client";
import { GantryApiError, type Task } from "../services/gantry/types";

/** Active matter — status from GET /v1/tasks/{id}. SSE/HITL in later slices. */
export function Engagement() {
  const { taskId } = useParams();
  const location = useLocation();
  const navState = (location.state || {}) as { goal?: string; project_id?: string };
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getTask(taskId)
      .then((t) => {
        if (!cancelled) setTask(t);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg =
          e instanceof GantryApiError
            ? e.detail
            : e instanceof Error
              ? e.message
              : "Failed to load run";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  return (
    <div style={{ padding: "48px 32px 32px", maxWidth: 720 }}>
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
        Work order received. Stream and HITL cards land in the next slices — status below is from{" "}
        <code style={{ fontSize: 12 }}>GET /v1/tasks/{"{id}"}</code>.
      </p>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
      ) : null}
      {error ? <p style={{ color: "#b45309", fontSize: 13 }}>{error}</p> : null}

      {task ? (
        <dl
          style={{
            margin: 0,
            padding: 16,
            borderRadius: 14,
            background: "rgba(255,255,255,0.65)",
            border: "1px solid var(--border-subtle)",
            display: "grid",
            gap: 10,
            fontSize: 14,
          }}
        >
          <div>
            <dt style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
              Status
            </dt>
            <dd style={{ margin: "2px 0 0", fontWeight: 600 }}>{task.status}</dd>
          </div>
          {(task.goal || navState.goal) ? (
            <div>
              <dt style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                Goal
              </dt>
              <dd style={{ margin: "2px 0 0" }}>{task.goal || navState.goal}</dd>
            </div>
          ) : null}
          {(task.project_id || navState.project_id) ? (
            <div>
              <dt style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                Project
              </dt>
              <dd style={{ margin: "2px 0 0" }}>{task.project_id || navState.project_id}</dd>
            </div>
          ) : null}
          {task.result ? (
            <div>
              <dt style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                Result
              </dt>
              <dd style={{ margin: "2px 0 0" }}>
                <pre
                  style={{
                    margin: 0,
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                    color: "var(--text-secondary)",
                  }}
                >
                  {JSON.stringify(task.result, null, 2)}
                </pre>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
