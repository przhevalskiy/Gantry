import { useState } from "react";
import { Composer } from "../modules/composer/Composer";
import { SuggestionChips } from "../modules/composer/SuggestionChips";

/** Wireframe home — firm greeting + work-order composer. */
export function ComposeHome() {
  const [goal, setGoal] = useState("");

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 28px 64px",
        minHeight: 0,
      }}
    >
      <p
        style={{
          margin: "0 0 28px",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(28px, 4vw, 40px)",
          fontWeight: 600,
          letterSpacing: "-0.03em",
          textAlign: "center",
          color: "var(--text-primary)",
        }}
      >
        What should the firm take on?
      </p>

      <Composer value={goal} onChange={setGoal} onSubmit={() => {}} />
      <SuggestionChips onPick={setGoal} />

      <p
        style={{
          marginTop: 28,
          fontSize: 13,
          color: "var(--text-muted)",
          textAlign: "center",
          maxWidth: 420,
          lineHeight: 1.45,
        }}
      >
        File a work order. The Foreman staffs Operators and closes with a structured artifact — not a chat farewell.
      </p>
    </div>
  );
}
