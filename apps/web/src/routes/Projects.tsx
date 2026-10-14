import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { formatWhen } from "../lib/format";
import { paths } from "../lib/paths";
import { createProject, listProjects } from "../services/gantry/client";
import { GantryApiError, type Project } from "../services/gantry/types";

/** Workspaces — GET/POST /v1/projects. */
export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setProjects(await listProjects());
    } catch (e) {
      setError(
        e instanceof GantryApiError
          ? e.detail
          : e instanceof Error
            ? e.message
            : "Failed to load projects",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createProject({
        name: n,
        github_url: githubUrl.trim() || null,
      });
      setProjects((prev) => [project, ...prev]);
      setName("");
      setGithubUrl("");
    } catch (err) {
      setError(
        err instanceof GantryApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Create failed",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ padding: "48px 32px 32px", maxWidth: 720 }}>
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: 28,
          fontWeight: 650,
          letterSpacing: "-0.02em",
        }}
      >
        Projects
      </h1>
      <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        Workspaces runs attach to — usually a GitHub-linked repo.
      </p>

      <form
        onSubmit={handleCreate}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 28,
          alignItems: "center",
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          aria-label="Project name"
          className="input-bar"
          style={fieldStyle}
        />
        <input
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          placeholder="GitHub URL (optional)"
          aria-label="GitHub URL"
          className="input-bar"
          style={{ ...fieldStyle, flex: 1.2 }}
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          style={{
            height: "var(--input-control-size)",
            padding: "0 14px",
            borderRadius: 10,
            background: "var(--cta-primary-bg)",
            color: "var(--cta-primary-fg)",
            fontWeight: 600,
            fontSize: 13,
            opacity: creating || !name.trim() ? 0.5 : 1,
          }}
        >
          Create
        </button>
      </form>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
      ) : null}
      {error ? <p style={{ color: "#b45309", fontSize: 13 }}>{error}</p> : null}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 0 }}>
        {projects.map((p) => (
          <li
            key={p.id}
            style={{
              padding: "14px 0",
              borderBottom: "1px solid var(--border-subtle)",
              display: "grid",
              gap: 6,
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
              <strong style={{ fontSize: 16 }}>{p.name}</strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {formatWhen(p.created_at)}
              </span>
            </div>
            {p.github_url ? (
              <a
                href={p.github_url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 13, color: "var(--accent-600)", wordBreak: "break-all" }}
              >
                {p.github_url}
              </a>
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No GitHub URL</span>
            )}
            <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
              <Link
                to={`${paths.runs}?project=${encodeURIComponent(p.id)}`}
                style={{ color: "var(--accent-600)", fontWeight: 600 }}
              >
                View runs
              </Link>
              <Link to={paths.home} style={{ color: "var(--text-secondary)" }}>
                New run
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  flex: 1,
  minWidth: 140,
  height: "auto",
  borderRadius: 10,
  border: "1px solid var(--border-subtle)",
  background: "var(--panel-bg)",
  padding: "0.4rem 0.875rem",
  fontSize: 13,
};
