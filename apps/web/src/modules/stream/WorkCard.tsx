import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { WorkStage } from "./groupWork";

/**
 * Multi-step firm work card — one bubble per stage, steps nested inside
 * (Cursor/Claude-style agent turn; not one chat line per dispatch).
 */
export function WorkCard({ stage }: { stage: WorkStage }) {
  const [open, setOpen] = useState(
    () => stage.status === "running" || stage.status === "blocked",
  );

  const summary =
    stage.steps[stage.steps.length - 1]?.text ||
    `${stage.steps.length} step${stage.steps.length === 1 ? "" : "s"}`;

  return (
    <div
      style={{
        alignSelf: "stretch",
        maxWidth: "min(560px, 100%)",
        borderRadius: 16,
        border: "1px solid var(--border-subtle)",
        background: "rgba(255,255,255,0.9)",
        boxShadow: "0 1px 3px rgba(40,30,70,0.05)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          textAlign: "left",
          background: "transparent",
        }}
      >
        <StatusPip status={stage.status} />
        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 650, letterSpacing: "-0.01em" }}>
            {stage.title}
          </span>
          {!open ? (
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {summary}
            </span>
          ) : null}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {stage.steps.length} step{stage.steps.length === 1 ? "" : "s"}
          {open ? (
            <ChevronUp size={14} strokeWidth={1.75} aria-hidden />
          ) : (
            <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
          )}
        </span>
      </button>

      {open ? (
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: "0 14px 12px",
            display: "grid",
            gap: 8,
          }}
        >
          {stage.steps.map((step) => (
            <li
              key={step.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "2px 8px",
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              <span
                style={{
                  gridColumn: "1 / -1",
                  fontSize: 10,
                  fontWeight: 650,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                {step.seat || "Firm"}
              </span>
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  marginTop: 6,
                  background:
                    step.tone === "done"
                      ? "#10b981"
                      : step.tone === "warn"
                        ? "#d97706"
                        : "var(--accent-500)",
                  opacity: 0.85,
                }}
              />
              <span
                style={{
                  color:
                    step.tone === "warn"
                      ? "#92400e"
                      : "var(--text-secondary)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {step.text}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function StatusPip({ status }: { status: WorkStage["status"] }) {
  const color =
    status === "done"
      ? "#10b981"
      : status === "blocked"
        ? "#d97706"
        : "var(--accent-500)";
  return (
    <span
      aria-label={status}
      title={status}
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        marginTop: 5,
        background: color,
        boxShadow:
          status === "running"
            ? `0 0 0 3px color-mix(in srgb, ${color} 35%, transparent)`
            : undefined,
        flexShrink: 0,
        animation: status === "running" ? "floor-breathe 2.8s ease-in-out infinite" : undefined,
      }}
    />
  );
}
