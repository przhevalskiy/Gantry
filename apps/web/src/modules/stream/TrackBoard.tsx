import type { TrackChain } from "./synthesizeStory";

/** Parallel builder chains derived from the Architect plan. */
export function TrackBoard({ tracks }: { tracks: TrackChain[] }) {
  return (
    <section
      style={{
        alignSelf: "stretch",
        maxWidth: "min(600px, 100%)",
        borderRadius: 16,
        border: "1px solid var(--border-subtle)",
        background: "rgba(255,255,255,0.9)",
        padding: "12px 14px 14px",
        display: "grid",
        gap: 10,
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Builder chains</p>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
          What will run in parallel after you approve
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
                background:
                  t.status === "dropped"
                    ? "#d97706"
                    : t.status === "planned"
                      ? "#94a3b8"
                      : t.status === "done"
                        ? "#10b981"
                        : "var(--accent-500)",
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 650 }}>{t.name}</div>
              {t.detail ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {t.detail}
                </div>
              ) : null}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 650,
                color: "var(--text-muted)",
                textTransform: "capitalize",
              }}
            >
              {t.status === "planned" ? "Queued" : t.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
