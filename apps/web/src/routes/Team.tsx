import { useEffect, useState } from "react";
import { OperatorPortrait } from "../modules/engagement-floor";
import { listAgents } from "../services/gantry/client";
import { GantryApiError, type AgentSeat } from "../services/gantry/types";

/** Operator directory — GET /v1/agents. */
export function Team() {
  const [agents, setAgents] = useState<AgentSeat[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [acp, setAcp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void listAgents()
      .then((cat) => {
        if (cancelled) return;
        setAgents(cat.agents ?? []);
        setSummary(cat.product?.summary ?? null);
        setAcp(cat.acp_agent ?? null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof GantryApiError
            ? e.detail
            : e instanceof Error
              ? e.message
              : "Failed to load team",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: "48px 32px 32px", maxWidth: 800 }}>
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: 28,
          fontWeight: 650,
          letterSpacing: "-0.02em",
        }}
      >
        Team
      </h1>
      <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {summary ||
          "Operator directory — Foreman and Temporal seats. One ACP entrypoint: swarm-factory."}
        {acp ? (
          <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
            ACP: {acp}
          </span>
        ) : null}
      </p>
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
      ) : null}
      {error ? <p style={{ color: "#b45309", fontSize: 13 }}>{error}</p> : null}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 20 }}>
        {agents.map((a) => (
          <li
            key={a.name}
            style={{
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              paddingBottom: 18,
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <OperatorPortrait role={a.role} name={a.name} presence="idle" size={56} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <strong style={{ fontSize: 16 }}>{a.role}</strong>
                {a.level ? (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.level}</span>
                ) : null}
                {a.entrypoint ? (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.entrypoint}</span>
                ) : null}
              </div>
              {a.description ? (
                <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.45 }}>
                  {a.description}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
