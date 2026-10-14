import type { TrackChain } from "./groupWork";

/**
 * Parallel work chains (Architect tracks) — what’s in flight, dropped, or waiting.
 */
export function TrackBoard({ tracks }: { tracks: TrackChain[] }) {
  return (
    <section
      style={{
        alignSelf: "stretch",
        maxWidth: "min(600px, 100%)",
        borderRadius: 16,
        border: "1px solid var(--border-subtle)",
        background: "rgba(255,255,255,0.88)",
        padding: "12px 14px 14px",
        display: "grid",
        gap: 10,
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 650 }}>Work chains</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
          Parallel tracks the Architect opened for Builders
        </p>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {tracks.map((t) => (
          <li
            key={t.id}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 10,
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: 12,
              background: "var(--shell-bg)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: pipColor(t.status),
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 650 }}>{t.name}</div>
              {t.detail ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.detail}
                </div>
              ) : null}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 650,
                textTransform: "capitalize",
                color: "var(--text-muted)",
              }}
            >
              {t.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function pipColor(status: TrackChain["status"]): string {
  switch (status) {
    case "dropped":
      return "#d97706";
    case "done":
      return "#10b981";
    case "running":
      return "var(--accent-500)";
    default:
      return "#94a3b8";
  }
}
