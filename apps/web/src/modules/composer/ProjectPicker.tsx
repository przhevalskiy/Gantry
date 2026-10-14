import { FolderKanban, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { createProject, listProjects } from "../../services/gantry/client";
import { GantryApiError, type Project } from "../../services/gantry/types";

export function ProjectPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (projectId: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const list = await listProjects();
      setProjects(list);
      if (!value && list[0]?.id) onChange(list[0].id);
    } catch (e) {
      const msg =
        e instanceof GantryApiError
          ? e.detail
          : e instanceof Error
            ? e.message
            : "Failed to load projects";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createProject({
        name,
        github_url: newUrl.trim() || null,
      });
      setProjects((prev) => [project, ...prev]);
      onChange(project.id);
      setNewName("");
      setNewUrl("");
    } catch (err) {
      const msg =
        err instanceof GantryApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Create failed";
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ width: "min(720px, 100%)", marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <FolderKanban size={14} strokeWidth={1.75} aria-hidden />
          Project
        </label>
        <select
          className="input-bar"
          aria-label="Project"
          disabled={loading || projects.length === 0}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            minWidth: 160,
            height: "auto",
            maxHeight: "none",
            borderRadius: 999,
            border: "1px solid var(--border-subtle)",
            background: "var(--panel-bg)",
            padding: "0.4rem 0.875rem",
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          {projects.length === 0 ? (
            <option value="">No projects yet</option>
          ) : (
            projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))
          )}
        </select>
      </div>

      <form
        onSubmit={handleCreate}
        style={{
          display: "flex",
          gap: 8,
          marginTop: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          className="input-bar"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name"
          aria-label="New project name"
          style={{
            flex: 1,
            minWidth: 140,
            height: "auto",
            maxHeight: "none",
            borderRadius: 999,
            border: "1px solid var(--border-subtle)",
            background: "var(--panel-bg)",
            padding: "0.4rem 0.875rem",
            fontSize: 13,
          }}
        />
        <input
          className="input-bar"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="GitHub URL (optional)"
          aria-label="GitHub URL"
          style={{
            flex: 1.2,
            minWidth: 180,
            height: "auto",
            maxHeight: "none",
            borderRadius: 999,
            border: "1px solid var(--border-subtle)",
            background: "var(--panel-bg)",
            padding: "0.4rem 0.875rem",
            fontSize: 13,
          }}
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: "var(--input-control-size)",
            padding: "0 12px",
            borderRadius: 999,
            background: "var(--cta-primary-bg)",
            color: "var(--cta-primary-fg)",
            fontSize: 13,
            opacity: creating || !newName.trim() ? 0.5 : 1,
          }}
        >
          <Plus size={14} strokeWidth={2} aria-hidden />
          Add
        </button>
      </form>

      {error ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#b45309" }}>{error}</p>
      ) : null}
      {loading ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
          Loading projects…
        </p>
      ) : null}
    </div>
  );
}
