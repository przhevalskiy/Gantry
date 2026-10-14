import { ArrowUp, BookOpen, FolderKanban, LoaderCircle, X } from "lucide-react";
import {
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { listPlaybooks, listProjects } from "../../services/gantry/client";
import { ComposerMenu } from "./ComposerMenu";

/**
 * Claude / Manus-shaped work-order bar: goal + in-bar chips + `+` disclosure.
 * Parent handles POST /v1/tasks (P1).
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  projectId,
  playbookId,
  onProjectChange,
  onPlaybookChange,
  submitting = false,
  error = null,
  placeholder = "File a work order…",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (goal: string) => void;
  projectId: string | null;
  playbookId: string | null;
  onProjectChange: (id: string) => void;
  onPlaybookChange: (id: string | null) => void;
  submitting?: boolean;
  error?: string | null;
  placeholder?: string;
}) {
  const [projectLabel, setProjectLabel] = useState<string | null>(null);
  const [briefLabel, setBriefLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setProjectLabel(null);
      return;
    }
    let cancelled = false;
    void listProjects()
      .then((list) => {
        if (!cancelled) {
          setProjectLabel(list.find((p) => p.id === projectId)?.name ?? "Project");
        }
      })
      .catch(() => {
        if (!cancelled) setProjectLabel("Project");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!playbookId) {
      setBriefLabel(null);
      return;
    }
    let cancelled = false;
    void listPlaybooks()
      .then((list) => {
        if (!cancelled) {
          setBriefLabel(list.find((b) => b.id === playbookId)?.label ?? playbookId);
        }
      })
      .catch(() => {
        if (!cancelled) setBriefLabel(playbookId);
      });
    return () => {
      cancelled = true;
    };
  }, [playbookId]);

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const goal = value.trim();
    if (!goal || submitting || !projectId) return;
    onSubmit(goal);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const canSend = Boolean(value.trim() && projectId && !submitting);

  return (
    <form onSubmit={handleSubmit} style={{ width: "min(720px, 100%)" }}>
      <div
        className="input-bar"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          borderRadius: 22,
          background: "var(--panel-bg)",
          boxShadow: "var(--panel-shadow)",
          border: "1px solid var(--border-subtle)",
          paddingBlock: 12,
        }}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Work order goal"
          disabled={submitting}
          rows={2}
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            resize: "none",
            background: "transparent",
            fontSize: 15,
            lineHeight: 1.45,
            padding: 0,
            minHeight: 48,
            fontFamily: "var(--font-sans)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <ComposerMenu
            projectId={projectId}
            playbookId={playbookId}
            onSelectProject={onProjectChange}
            onSelectPlaybook={onPlaybookChange}
          />

          {projectId ? (
            <Chip
              icon={<FolderKanban size={13} strokeWidth={1.75} />}
              label={projectLabel || "Project"}
            />
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Choose a project via +
            </span>
          )}

          {playbookId ? (
            <Chip
              icon={<BookOpen size={13} strokeWidth={1.75} />}
              label={briefLabel || "Brief"}
              onClear={() => onPlaybookChange(null)}
            />
          ) : null}

          <div style={{ flex: 1 }} />

          <button
            type="submit"
            aria-label="Submit work order"
            disabled={!canSend}
            style={{
              width: "var(--input-control-size)",
              height: "var(--input-control-size)",
              borderRadius: "50%",
              background: "var(--cta-primary-bg)",
              color: "var(--cta-primary-fg)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              opacity: canSend ? 1 : 0.4,
            }}
          >
            {submitting ? (
              <LoaderCircle size={16} strokeWidth={2.25} className="spin" aria-hidden />
            ) : (
              <ArrowUp size={16} strokeWidth={2.25} aria-hidden />
            )}
          </button>
        </div>
      </div>

      {error ? (
        <p
          style={{
            margin: "10px 4px 0",
            fontSize: 12,
            color: "#b45309",
            textAlign: "center",
          }}
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}

function Chip({
  icon,
  label,
  onClear,
}: {
  icon: ReactNode;
  label: string;
  onClear?: () => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: "var(--input-control-size)",
        padding: onClear ? "0 6px 0 10px" : "0 10px",
        borderRadius: 999,
        background: "var(--shell-bg)",
        border: "1px solid var(--border-subtle)",
        fontSize: 12,
        color: "var(--text-secondary)",
        maxWidth: 180,
      }}
    >
      <span style={{ display: "grid", color: "var(--text-muted)" }}>{icon}</span>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: 550,
        }}
      >
        {label}
      </span>
      {onClear ? (
        <button
          type="button"
          aria-label={`Clear ${label}`}
          onClick={onClear}
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            color: "var(--text-muted)",
          }}
        >
          <X size={12} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
