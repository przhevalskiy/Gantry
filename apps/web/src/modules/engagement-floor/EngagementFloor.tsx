import { useEffect, useState } from "react";
import { listAgents } from "../../services/gantry/client";
import type { AgentSeat, PendingHitl } from "../../services/gantry/types";
import { OperatorPortrait, type Presence } from "./OperatorPortrait";

const STAGE_ORDER = [
  "foreman",
  "pm",
  "architect",
  "builder",
  "inspector",
  "reviewer",
  "oracle",
  "security",
  "devops",
];

function stageKey(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("foreman")) return "foreman";
  if (r === "pm") return "pm";
  if (r.includes("architect")) return "architect";
  if (r.includes("builder")) return "builder";
  if (r.includes("inspector")) return "inspector";
  if (r.includes("reviewer")) return "reviewer";
  if (r.includes("oracle") || r.includes("a11y")) return "oracle";
  if (r.includes("security")) return "security";
  if (r.includes("devops")) return "devops";
  return r;
}

function sortSeats(agents: AgentSeat[]): AgentSeat[] {
  return [...agents].sort((a, b) => {
    const ia = STAGE_ORDER.indexOf(stageKey(a.role));
    const ib = STAGE_ORDER.indexOf(stageKey(b.role));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

function presenceFor(
  seat: AgentSeat,
  status: string | null,
  pending: PendingHitl[],
): Presence {
  const st = (status || "").toLowerCase();
  if (st === "completed" || st === "failed" || st === "cancelled" || st === "terminated") {
    return "done";
  }
  const key = stageKey(seat.role);
  if (pending.length > 0) {
    const ck = pending[0].checkpoint.toLowerCase();
    if (key === "architect" && ck.includes("architect")) return "blocked";
    if (key === "pm" && ck.includes("pm")) return "blocked";
    if (key === "devops" && ck.includes("devops")) return "blocked";
    if (key === "foreman") return "active";
    return "idle";
  }
  if (st === "running" || st === "queued") {
    if (key === "foreman") return "active";
    if (st === "running" && (key === "builder" || key === "architect" || key === "pm")) {
      return "active";
    }
  }
  return key === "foreman" ? "active" : "idle";
}

/** Roster rail — who’s on the floor for this engagement. */
export function EngagementFloor({
  status,
  pendingHitl,
}: {
  status: string | null;
  pendingHitl: PendingHitl[];
}) {
  const [seats, setSeats] = useState<AgentSeat[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listAgents()
      .then((cat) => {
        if (cancelled) return;
        setSeats(sortSeats(cat.agents ?? []));
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load Operators");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted)" }}>{error}</p>
    );
  }
  if (seats.length === 0) return null;

  const active = seats.find(
    (s) => presenceFor(s, status, pendingHitl) === "blocked",
  ) || seats.find((s) => presenceFor(s, status, pendingHitl) === "active");

  const line =
    pendingHitl[0]?.description ||
    pendingHitl[0]?.action ||
    (pendingHitl[0]
      ? `Waiting on ${pendingHitl[0].checkpoint}`
      : active
        ? `${active.role} on the floor`
        : null);

  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        style={{
          margin: "0 0 12px",
          fontSize: 13,
          fontWeight: 650,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Engagement floor
      </h2>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "flex-start",
          padding: "4px 0 8px",
        }}
      >
        {seats.map((seat) => (
          <OperatorPortrait
            key={seat.name}
            role={seat.role}
            name={seat.name}
            presence={presenceFor(seat, status, pendingHitl)}
          />
        ))}
      </div>
      {line ? (
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
          {line}
        </p>
      ) : null}
    </section>
  );
}
