import type { TaskResult } from "../../services/gantry/types";

/** Structured deliverable climax — result is truth (I3 / P1), not chat farewell. */
export function ArtifactClimax({ result }: { result: TaskResult }) {
  const pr = typeof result.pr_url === "string" ? result.pr_url : null;
  const branch = typeof result.branch === "string" ? result.branch : null;
  const artifactType =
    typeof result.artifact_type === "string" ? result.artifact_type : null;
  const extras = Object.entries(result).filter(
    ([k]) => !["pr_url", "branch", "artifact_type"].includes(k),
  );

  return (
    <section style={{ marginBottom: 8 }}>
      <h2
        style={{
          margin: "0 0 8px",
          fontSize: 13,
          fontWeight: 650,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Deliverable
      </h2>
      <p
        style={{
          margin: "0 0 16px",
          fontSize: 22,
          fontWeight: 650,
          letterSpacing: "-0.02em",
        }}
      >
        {artifactType ? `${artifactType} ready` : "Artifact from the firm"}
      </p>
      <dl style={{ margin: 0, display: "grid", gap: 12, fontSize: 14 }}>
        {pr ? (
          <div>
            <dt
              style={{
                color: "var(--text-muted)",
                fontSize: 11,
                textTransform: "uppercase",
              }}
            >
              Pull request
            </dt>
            <dd style={{ margin: "4px 0 0" }}>
              <a
                href={pr}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "var(--accent-600)",
                  fontWeight: 600,
                  wordBreak: "break-all",
                }}
              >
                {pr}
              </a>
            </dd>
          </div>
        ) : null}
        {branch ? (
          <div>
            <dt
              style={{
                color: "var(--text-muted)",
                fontSize: 11,
                textTransform: "uppercase",
              }}
            >
              Branch
            </dt>
            <dd style={{ margin: "4px 0 0", fontWeight: 600 }}>{branch}</dd>
          </div>
        ) : null}
        {extras.length > 0 ? (
          <div>
            <dt
              style={{
                color: "var(--text-muted)",
                fontSize: 11,
                textTransform: "uppercase",
              }}
            >
              Details
            </dt>
            <dd style={{ margin: "4px 0 0" }}>
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  color: "var(--text-secondary)",
                  lineHeight: 1.45,
                }}
              >
                {JSON.stringify(Object.fromEntries(extras), null, 2)}
              </pre>
            </dd>
          </div>
        ) : null}
        {!pr && !branch && extras.length === 0 ? (
          <pre
            style={{
              margin: 0,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              color: "var(--text-secondary)",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
      </dl>
    </section>
  );
}
