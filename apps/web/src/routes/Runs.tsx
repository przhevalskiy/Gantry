import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatStatus, formatWhen } from "../lib/format";
import { paths } from "../lib/paths";
import { PageScroll } from "../shell/PageScroll";
import { listProjects, listTasks } from "../services/gantry/client";
import { GantryApiError, type Project, type Task } from "../services/gantry/types";

/** Matter list — GET /v1/tasks → Engagement. */
export function Runs() {
  const [params] = useSearchParams();
  const projectFilter = params.get("project");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([listTasks(80), listProjects()])
      .then(([taskRows, projectRows]) => {
        if (cancelled) return;
        setTasks(taskRows);
        setProjects(projectRows);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof GantryApiError
            ? e.detail
            : e instanceof Error
              ? e.message
              : "Failed to load runs",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const projectName = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, p.name]));
    return (id?: string) => (id ? map.get(id) || id.slice(0, 8) : "—");
  }, [projects]);

  const visible = projectFilter
    ? tasks.filter((t) => t.project_id === projectFilter)
    : tasks;

  const filterLabel = projectFilter
    ? projects.find((p) => p.id === projectFilter)?.name || projectFilter.slice(0, 8)
    : null;

  return (
    <PageScroll style={{ padding: "48px 32px 32px" }}>
    <div style={{ maxWidth: 800 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 650,
            letterSpacing: "-0.02em",
          }}
        >
          Runs
        </h1>
        <Link
          to={paths.home}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--accent-600)",
          }}
        >
          New run
        </Link>
      </div>
      <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        Engagements for the org
        {filterLabel ? (
          <>
            {" "}
            · project <strong>{filterLabel}</strong>{" "}
            <Link to={paths.runs} style={{ color: "var(--text-muted)", fontSize: 12 }}>
              clear
            </Link>
          </>
        ) : null}
        .
      </p>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
      ) : null}
      {error ? <p style={{ color: "#b45309", fontSize: 13 }}>{error}</p> : null}

      {!loading && !error && visible.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          No runs yet.{" "}
          <Link to={paths.home} style={{ color: "var(--accent-600)", fontWeight: 600 }}>
            File a work order
          </Link>
          .
        </p>
      ) : null}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 0 }}>
        {visible.map((t) => (
          <li key={t.task_id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <Link
              to={paths.engagement(t.task_id)}
              state={{ goal: t.goal, project_id: t.project_id }}
              style={{
                display: "grid",
                gap: 4,
                padding: "14px 0",
                color: "inherit",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.goal || t.task_id}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "capitalize",
                    flexShrink: 0,
                  }}
                >
                  {formatStatus(t.status)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {projectName(t.project_id)}
                {t.playbook ? ` · ${t.playbook}` : ""}
                {t.created_at || t.updated_at
                  ? ` · ${formatWhen(t.updated_at || t.created_at)}`
                  : ""}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
    </PageScroll>
  );
}
