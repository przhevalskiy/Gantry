import { OperatorPortrait } from "../engagement-floor/OperatorPortrait";
import type { Exchange } from "./groupWork";

/**
 * Who’s talking to whom on the floor — handoffs read as crew dialogue,
 * not a flat ops checklist.
 */
export function CrewDialogue({
  exchanges,
  status,
}: {
  exchanges: Exchange[];
  status: "running" | "blocked" | "done";
}) {
  return (
    <section
      style={{
        alignSelf: "stretch",
        maxWidth: "min(600px, 100%)",
        borderRadius: 16,
        border: "1px solid var(--border-subtle)",
        background: "rgba(255,255,255,0.92)",
        boxShadow: "0 1px 3px rgba(40,30,70,0.05)",
        padding: "12px 14px 14px",
        display: "grid",
        gap: 12,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 650,
              letterSpacing: "-0.01em",
            }}
          >
            Crew dialogue
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            How Operators are handing work on this engagement
          </p>
        </div>
        <StatusChip status={status} />
      </header>

      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 10,
        }}
      >
        {exchanges.map((ex) => (
          <li
            key={ex.id}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "8px 10px",
              alignItems: "start",
            }}
          >
            <OperatorPortrait
              role={ex.from}
              name={ex.from}
              presence={
                ex.tone === "done"
                  ? "done"
                  : ex.tone === "warn"
                    ? "blocked"
                    : status === "running"
                      ? "active"
                      : "idle"
              }
              size={32}
              showLabel={false}
            />
            <div style={{ minWidth: 0, paddingTop: 2 }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: 6,
                  marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 650 }}>{ex.from}</span>
                {ex.kind === "dispatch" && ex.to ? (
                  <>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>→</span>
                    <span style={{ fontSize: 12, fontWeight: 650, color: "var(--accent-600)" }}>
                      {ex.to}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 650,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                      }}
                    >
                      dispatch
                    </span>
                  </>
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 650,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                    }}
                  >
                    {ex.kind === "note" ? "note" : "update"}
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.45,
                  color:
                    ex.tone === "warn"
                      ? "#92400e"
                      : "var(--text-secondary)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {ex.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StatusChip({ status }: { status: "running" | "blocked" | "done" }) {
  const label =
    status === "blocked" ? "Waiting on you" : status === "done" ? "Settled" : "Live";
  const color =
    status === "blocked" ? "#d97706" : status === "done" ? "#10b981" : "var(--accent-500)";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 650,
        color,
        padding: "4px 8px",
        borderRadius: 999,
        background: "var(--shell-bg)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {label}
    </span>
  );
}
