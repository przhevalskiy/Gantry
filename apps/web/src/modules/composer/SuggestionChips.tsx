/** Firm-shaped starters — not consumer “create games / slides” chips. */
const SUGGESTIONS = [
  { label: "Add health check", goal: "Add a /health endpoint that returns 200" },
  { label: "Backlog item", goal: "Implement the next small backlog item from the project brief" },
  { label: "A11y pass", goal: "Remediate accessibility issues in the primary UI flows" },
  { label: "Monorepo slice", goal: "Ship a package-scoped feature slice with clear boundaries" },
] as const;

export function SuggestionChips({
  onPick,
}: {
  onPick: (goal: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "center",
        marginTop: 16,
      }}
    >
      {SUGGESTIONS.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => onPick(s.goal)}
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            border: "1px solid var(--border-subtle)",
            background: "rgba(255,255,255,0.85)",
            fontSize: 13,
            color: "var(--text-secondary)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
