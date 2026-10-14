import type { StreamRow } from "./useTaskEventStream";
import type { TaskSseEvent, TaskSseMessage } from "../../services/gantry/types";

function messageText(message: TaskSseMessage): string {
  const c = message.content;
  if (typeof c === "string") return c;
  if (c == null) return "";
  try {
    return JSON.stringify(c, null, 2);
  } catch {
    return String(c);
  }
}

function labelFor(event: TaskSseEvent): string {
  switch (event.type) {
    case "status":
      return "Status";
    case "lifecycle":
      return "Lifecycle";
    case "message":
      return event.message.role ? `Message · ${event.message.role}` : "Message";
    case "hitl":
      return "Approval needed";
    case "error":
      return "Error";
    case "done":
      return "Done";
    default:
      return "Event";
  }
}

function bodyFor(event: TaskSseEvent): string {
  switch (event.type) {
    case "status":
      return event.status;
    case "lifecycle":
      return event.event;
    case "message":
      return messageText(event.message) || "(empty)";
    case "hitl":
      return [
        event.checkpoint,
        event.description,
        event.workflow_id ? `wf ${event.workflow_id}` : null,
      ]
        .filter(Boolean)
        .join(" — ");
    case "error":
      return event.message;
    case "done":
      return event.status;
    default:
      return "";
  }
}

/** Observability timeline — narrative only; structured result is elsewhere (I3). */
export function StreamTimeline({
  rows,
  live,
}: {
  rows: StreamRow[];
  live: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
        {live ? "Waiting for stream events…" : "No stream events yet."}
      </p>
    );
  }

  return (
    <ol
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {rows.map((row) => (
        <li
          key={row.id}
          style={{
            display: "grid",
            gap: 4,
            paddingBottom: 14,
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            {labelFor(row.event)}
          </span>
          <span
            style={{
              fontSize: 14,
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            {bodyFor(row.event)}
          </span>
        </li>
      ))}
    </ol>
  );
}
