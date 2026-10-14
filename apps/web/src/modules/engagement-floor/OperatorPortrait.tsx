import type { CSSProperties } from "react";

export type Presence = "idle" | "active" | "blocked" | "done";

/** CSS silhouette portrait shell — craft kit later; same firm bezel (brand guide). */
export function OperatorPortrait({
  role,
  name,
  presence = "idle",
  size = 52,
  showLabel = true,
}: {
  role: string;
  name: string;
  presence?: Presence;
  size?: number;
  showLabel?: boolean;
}) {
  const motif = motifFor(role);
  const field =
    presence === "active"
      ? "var(--floor-active)"
      : presence === "blocked"
        ? "var(--floor-blocked)"
        : presence === "done"
          ? "var(--floor-done)"
          : "transparent";

  const shell: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    position: "relative",
    flexShrink: 0,
    background: motif.gradient,
    boxShadow:
      presence === "idle"
        ? "inset 0 0 0 1.5px rgba(255,255,255,0.55), 0 1px 2px rgba(40,30,70,0.08)"
        : `inset 0 0 0 1.5px rgba(255,255,255,0.65), 0 0 0 3px ${field}, 0 2px 8px rgba(40,30,70,0.12)`,
    animation:
      presence === "active"
        ? "floor-breathe 2.8s ease-in-out infinite"
        : presence === "blocked"
          ? "floor-hold 1.8s ease-in-out infinite"
          : undefined,
    opacity: presence === "idle" ? 0.72 : 1,
    transition: "opacity 240ms ease, box-shadow 240ms ease",
  };

  return (
    <div
      style={{
        display: "grid",
        justifyItems: "center",
        gap: showLabel ? 6 : 0,
        width: showLabel ? size + 12 : size,
      }}
    >
      <div style={shell} title={`${role} · ${name}`} aria-label={`${role}, ${presence}`}>
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: "18% 22% 28%",
            borderRadius: "42% 42% 38% 38%",
            background: motif.bust,
            opacity: 0.92,
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            bottom: "14%",
            transform: "translateX(-50%)",
            width: "42%",
            height: "18%",
            borderRadius: 3,
            background: motif.prop,
            opacity: 0.85,
          }}
        />
        {presence === "done" ? (
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: 2,
              bottom: 2,
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "var(--cta-primary-bg)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
            }}
          />
        ) : null}
      </div>
      {showLabel ? (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-secondary)",
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: size + 24,
          }}
        >
          {role}
        </span>
      ) : null}
    </div>
  );
}

function motifFor(role: string): { gradient: string; bust: string; prop: string } {
  const r = role.toLowerCase();
  if (r.includes("foreman")) {
    return {
      gradient: "linear-gradient(145deg,#ddd6fe,#a78bfa 55%,#7c6cf0)",
      bust: "rgba(30,20,60,0.35)",
      prop: "rgba(255,255,255,0.55)",
    };
  }
  if (r === "pm") {
    return {
      gradient: "linear-gradient(145deg,#f5e6d3,#e8c4a8)",
      bust: "rgba(80,50,30,0.28)",
      prop: "rgba(255,248,240,0.7)",
    };
  }
  if (r.includes("architect")) {
    return {
      gradient: "linear-gradient(145deg,#dbeafe,#93c5fd 60%,#60a5fa)",
      bust: "rgba(20,40,80,0.3)",
      prop: "rgba(255,255,255,0.65)",
    };
  }
  if (r.includes("builder")) {
    return {
      gradient: "linear-gradient(145deg,#d1fae5,#6ee7b7 55%,#34d399)",
      bust: "rgba(20,60,40,0.3)",
      prop: "rgba(255,255,255,0.6)",
    };
  }
  if (r.includes("inspector")) {
    return {
      gradient: "linear-gradient(145deg,#e0e7ff,#a5b4fc)",
      bust: "rgba(30,40,90,0.3)",
      prop: "rgba(255,255,255,0.65)",
    };
  }
  if (r.includes("reviewer")) {
    return {
      gradient: "linear-gradient(145deg,#fce7f3,#f9a8d4)",
      bust: "rgba(70,30,50,0.28)",
      prop: "rgba(255,255,255,0.65)",
    };
  }
  if (r.includes("security")) {
    return {
      gradient: "linear-gradient(145deg,#e2e8f0,#94a3b8 55%,#64748b)",
      bust: "rgba(20,30,40,0.35)",
      prop: "rgba(255,255,255,0.55)",
    };
  }
  if (r.includes("devops")) {
    return {
      gradient: "linear-gradient(145deg,#cffafe,#67e8f9 55%,#22d3ee)",
      bust: "rgba(10,50,60,0.3)",
      prop: "rgba(255,255,255,0.65)",
    };
  }
  if (r.includes("oracle") || r.includes("a11y")) {
    return {
      gradient: "linear-gradient(145deg,#fef3c7,#fcd34d)",
      bust: "rgba(70,50,10,0.28)",
      prop: "rgba(255,255,255,0.7)",
    };
  }
  return {
    gradient: "linear-gradient(145deg,#ede9fe,#c4b5fd)",
    bust: "rgba(40,30,70,0.28)",
    prop: "rgba(255,255,255,0.6)",
  };
}
