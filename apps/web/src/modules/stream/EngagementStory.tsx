import { OperatorPortrait } from "../engagement-floor/OperatorPortrait";
import type { StoryBeat } from "./synthesizeStory";

/**
 * Plain-language engagement story — what each Operator accomplished,
 * not a replay of dispatch logs.
 */
export function EngagementStory({
  beats,
  waitingOnYou,
}: {
  beats: StoryBeat[];
  waitingOnYou: boolean;
}) {
  return (
    <section
      style={{
        alignSelf: "stretch",
        maxWidth: "min(600px, 100%)",
        borderRadius: 16,
        border: "1px solid var(--border-subtle)",
        background: "rgba(255,255,255,0.94)",
        boxShadow: "0 1px 3px rgba(40,30,70,0.05)",
        padding: "14px 16px 16px",
        display: "grid",
        gap: 14,
      }}
    >
      <header>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 650, letterSpacing: "-0.01em" }}>
          What the firm did
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
          {waitingOnYou
            ? "Plan is ready — your approval unblocks Builders"
            : "Live progress on this engagement"}
        </p>
      </header>

      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 0,
        }}
      >
        {beats.map((beat, i) => (
          <li
            key={beat.id}
            style={{
              display: "grid",
              gridTemplateColumns: "auto auto 1fr",
              gap: "0 12px",
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 16,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  marginTop: 12,
                  background: pip(beat.state),
                  boxShadow:
                    beat.state === "active"
                      ? "0 0 0 3px rgba(139,124,246,0.28)"
                      : undefined,
                  flexShrink: 0,
                }}
              />
              {i < beats.length - 1 ? (
                <span
                  aria-hidden
                  style={{
                    flex: 1,
                    width: 2,
                    minHeight: 16,
                    marginTop: 4,
                    background: "var(--border-subtle)",
                  }}
                />
              ) : null}
            </div>

            {beat.actor === "You" ? (
              <div
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  marginTop: 4,
                  background: "var(--cta-primary-bg)",
                  color: "var(--cta-primary-fg)",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                You
              </div>
            ) : (
              <OperatorPortrait
                role={beat.actor}
                name={beat.actor}
                presence={
                  beat.state === "blocked"
                    ? "blocked"
                    : beat.state === "done"
                      ? "done"
                      : beat.state === "active"
                        ? "active"
                        : "idle"
                }
                size={32}
                showLabel={false}
              />
            )}

            <div style={{ padding: "4px 0 16px", minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "baseline",
                  marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 650 }}>{beat.actor}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 650,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: labelColor(beat.state),
                  }}
                >
                  {label(beat.state)}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 550,
                  lineHeight: 1.4,
                  letterSpacing: "-0.01em",
                  color: "var(--text-primary)",
                }}
              >
                {beat.headline}
              </p>
              {beat.detail ? (
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: "var(--text-muted)",
                  }}
                >
                  {beat.detail}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function pip(state: StoryBeat["state"]): string {
  switch (state) {
    case "done":
      return "#10b981";
    case "blocked":
    case "warn":
      return "#d97706";
    case "active":
      return "var(--accent-500)";
    default:
      return "#94a3b8";
  }
}

function label(state: StoryBeat["state"]): string {
  switch (state) {
    case "done":
      return "Done";
    case "blocked":
      return "Needs you";
    case "warn":
      return "Watch";
    case "active":
      return "In progress";
    default:
      return "";
  }
}

function labelColor(state: StoryBeat["state"]): string {
  switch (state) {
    case "done":
      return "#059669";
    case "blocked":
    case "warn":
      return "#b45309";
    case "active":
      return "var(--accent-600)";
    default:
      return "var(--text-muted)";
  }
}
