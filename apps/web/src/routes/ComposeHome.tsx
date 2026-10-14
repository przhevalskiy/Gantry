import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiKeyField } from "../modules/auth/ApiKeyField";
import { Composer } from "../modules/composer/Composer";
import { ProjectPicker } from "../modules/composer/ProjectPicker";
import { SuggestionChips } from "../modules/composer/SuggestionChips";
import { paths } from "../lib/paths";
import { submitTask } from "../services/gantry/client";
import { GantryApiError } from "../services/gantry/types";

/** Wireframe home — file a work order (POST /v1/tasks). */
export function ComposeHome() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(nextGoal: string) {
    if (!projectId) {
      setError("Select or create a project before filing a work order.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitTask({
        goal: nextGoal,
        project_id: projectId,
        tier: -1,
      });
      navigate(paths.engagement(res.task_id), {
        state: { goal: nextGoal, project_id: projectId },
      });
    } catch (e) {
      const msg =
        e instanceof GantryApiError
          ? e.detail
          : e instanceof Error
            ? e.message
            : "Submit failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

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

      <ApiKeyField />
      <ProjectPicker value={projectId} onChange={setProjectId} />
      <Composer
        value={goal}
        onChange={setGoal}
        onSubmit={handleSubmit}
        disabled={!projectId}
        submitting={submitting}
        error={error}
      />
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
        File a work order. The Foreman staffs Operators and closes with a structured artifact — not a
        chat farewell.
      </p>
    </div>
  );
}
