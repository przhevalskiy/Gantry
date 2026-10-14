import { useEffect, useState } from "react";

/** Firm-voiced empty-state lines — rotate; brand stays in the shell wordmark. */
export const HEADLINES = [
  "What should the firm take on?",
  "What run should we staff?",
  "What artifact should we ship?",
  "Which matter needs the floor?",
  "What backlog item should close?",
  "Where should the Foreman start?",
] as const;

const INTERVAL_MS = 4200;

/** Crossfading headline carousel for the compose hero. */
export function HeadlineCarousel({
  lines = HEADLINES,
  intervalMs = INTERVAL_MS,
}: {
  lines?: readonly string[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (lines.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let fadeTimer: number | undefined;
    const tick = window.setInterval(() => {
      setVisible(false);
      fadeTimer = window.setTimeout(() => {
        setIndex((i) => (i + 1) % lines.length);
        setVisible(true);
      }, 280);
    }, intervalMs);

    return () => {
      window.clearInterval(tick);
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer);
    };
  }, [intervalMs, lines.length]);

  return (
    <p
      aria-live="polite"
      aria-atomic="true"
      style={{
        margin: "0 0 28px",
        fontFamily: "var(--font-display)",
        fontSize: "clamp(28px, 4vw, 40px)",
        fontWeight: 600,
        letterSpacing: "-0.03em",
        textAlign: "center",
        color: "var(--text-primary)",
        minHeight: "1.25em",
        maxWidth: 640,
        lineHeight: 1.2,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 280ms ease, transform 280ms ease",
      }}
    >
      {lines[index]}
    </p>
  );
}
