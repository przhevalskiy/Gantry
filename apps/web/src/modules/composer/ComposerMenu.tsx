import {
  ArrowLeft,
  BookOpen,
  FolderInput,
  FolderPlus,
  Plus,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { createProject, listPlaybooks, listProjects } from "../../services/gantry/client";
import {
  GantryApiError,
  type PlaybookBrief,
  type Project,
} from "../../services/gantry/types";

type Panel = "root" | "project" | "brief";

/**
 * Firm remap of Manus/Claude `+` menu — project + brief only.
 * No Skills / connectors / plugins marketplace.
 */
export function ComposerMenu({
  projectId,
  playbookId,
  onSelectProject,
  onSelectPlaybook,
}: {
  projectId: string | null;
  playbookId: string | null;
  onSelectProject: (id: string) => void;
  onSelectPlaybook: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("root");
  const rootRef = useRef<HTMLDivElement>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [briefs, setBriefs] = useState<PlaybookBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setPanel("root");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setPanel("root");
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function loadProjects() {
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

  async function loadBriefs() {
    setLoading(true);
    setError(null);
    try {
      setBriefs(await listPlaybooks());
    } catch (e) {
      setError(
        e instanceof GantryApiError
          ? e.detail
          : e instanceof Error
            ? e.message
            : "Failed to load briefs",
      );
    } finally {
      setLoading(false);
    }
  }

  function openPanel(next: Panel) {
    setPanel(next);
    setError(null);
    if (next === "project") void loadProjects();
    if (next === "brief") void loadBriefs();
  }

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
      onSelectProject(project.id);
      setNewName("");
      setNewUrl("");
      setOpen(false);
      setPanel("root");
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

  const selectedProject = projects.find((p) => p.id === projectId);
  const selectedBrief = briefs.find((b) => b.id === playbookId);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Add to work order"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setPanel("root");
          setError(null);
        }}
        style={{
          width: "var(--input-control-size)",
          height: "var(--input-control-size)",
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          color: "var(--text-secondary)",
          background: open ? "var(--nav-active-bg)" : "transparent",
          border: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <Plus size={18} strokeWidth={1.75} aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            left: 0,
            bottom: "calc(100% + 10px)",
            width: 280,
            maxHeight: 360,
            overflow: "auto",
            borderRadius: 14,
            background: "var(--panel-bg)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--panel-shadow)",
            padding: 6,
            zIndex: 50,
            animation: "composer-menu-in 140ms ease-out",
          }}
        >
          {panel === "root" ? (
            <>
              <MenuRow
                icon={<FolderInput size={16} strokeWidth={1.75} />}
                label="Add to project"
                hint={selectedProject?.name || (projectId ? "Selected" : undefined)}
                chevron
                onClick={() => openPanel("project")}
              />
              <MenuRow
                icon={<BookOpen size={16} strokeWidth={1.75} />}
                label="Choose brief"
                hint={selectedBrief?.label || (playbookId ? "Selected" : "Optional")}
                chevron
                onClick={() => openPanel("brief")}
              />
            </>
          ) : null}

          {panel === "project" ? (
            <>
              <MenuBack label="Projects" onClick={() => setPanel("root")} />
              {loading ? <MenuHint>Loading…</MenuHint> : null}
              {error ? <MenuHint tone="warn">{error}</MenuHint> : null}
              {projects.map((p) => (
                <MenuRow
                  key={p.id}
                  icon={<FolderInput size={16} strokeWidth={1.75} />}
                  label={p.name}
                  checked={p.id === projectId}
                  onClick={() => {
                    onSelectProject(p.id);
                    setOpen(false);
                    setPanel("root");
                  }}
                />
              ))}
              <div
                style={{
                  marginTop: 4,
                  paddingTop: 8,
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <form onSubmit={handleCreate} style={{ display: "grid", gap: 6, padding: "4px 6px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    <FolderPlus size={14} strokeWidth={1.75} aria-hidden />
                    New project
                  </div>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name"
                    aria-label="New project name"
                    style={fieldStyle}
                  />
                  <input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="GitHub URL (optional)"
                    aria-label="GitHub URL"
                    style={fieldStyle}
                  />
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    style={{
                      height: "var(--input-control-size)",
                      borderRadius: 10,
                      background: "var(--cta-primary-bg)",
                      color: "var(--cta-primary-fg)",
                      fontSize: 13,
                      fontWeight: 600,
                      opacity: creating || !newName.trim() ? 0.5 : 1,
                    }}
                  >
                    Create
                  </button>
                </form>
              </div>
            </>
          ) : null}

          {panel === "brief" ? (
            <>
              <MenuBack label="Briefs" onClick={() => setPanel("root")} />
              {loading ? <MenuHint>Loading…</MenuHint> : null}
              {error ? <MenuHint tone="warn">{error}</MenuHint> : null}
              <MenuRow
                icon={<BookOpen size={16} strokeWidth={1.75} />}
                label="No brief"
                hint="Default staffing"
                checked={!playbookId}
                onClick={() => {
                  onSelectPlaybook(null);
                  setOpen(false);
                  setPanel("root");
                }}
              />
              {briefs.map((b) => (
                <MenuRow
                  key={b.id}
                  icon={<BookOpen size={16} strokeWidth={1.75} />}
                  label={b.label}
                  hint={b.slug || b.id}
                  checked={b.id === playbookId}
                  onClick={() => {
                    onSelectPlaybook(b.id);
                    setOpen(false);
                    setPanel("root");
                  }}
                />
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const fieldStyle: CSSProperties = {
  borderRadius: 10,
  border: "1px solid var(--border-subtle)",
  background: "rgba(243,240,248,0.9)",
  padding: "0.4rem 0.7rem",
  fontSize: 13,
};

function MenuBack({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-secondary)",
      }}
    >
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}

function MenuHint({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "warn";
}) {
  return (
    <p
      style={{
        margin: "4px 10px",
        fontSize: 12,
        color: tone === "warn" ? "#b45309" : "var(--text-muted)",
      }}
    >
      {children}
    </p>
  );
}

function MenuRow({
  icon,
  label,
  hint,
  chevron,
  checked,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  chevron?: boolean;
  checked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 10px",
        borderRadius: 10,
        fontSize: 13,
        color: "var(--text-primary)",
        background: checked ? "var(--nav-active-bg)" : "transparent",
        textAlign: "left",
      }}
    >
      <span style={{ color: "var(--text-secondary)", display: "grid" }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 550 }}>{label}</span>
        {hint ? (
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {hint}
          </span>
        ) : null}
      </span>
      {checked ? (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent-600)",
            flexShrink: 0,
          }}
        />
      ) : null}
      {chevron ? (
        <span style={{ color: "var(--text-muted)", fontSize: 16, lineHeight: 1 }}>›</span>
      ) : null}
    </button>
  );
}
