import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Composer } from "../modules/composer/Composer";
import { HeadlineCarousel } from "../modules/composer/HeadlineCarousel";
import { SuggestionChips } from "../modules/composer/SuggestionChips";
import { paths } from "../lib/paths";
import { listProjects, submitTask } from "../services/gantry/client";
import { GantryApiError } from "../services/gantry/types";

/** Wireframe home — headline + Claude-shaped composer only. */
export function ComposeHome() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [playbookId, setPlaybookId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listProjects()
      .then((list) => {
        if (!cancelled && list[0]?.id) setProjectId((cur) => cur ?? list[0].id);
      })
      .catch(() => {
        /* picker handles empty / errors */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(nextGoal: string) {
    if (!projectId) {
      setError("Choose a project from + before filing a work order.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitTask({
        goal: nextGoal,
        project_id: projectId,
        tier: -1,
        playbook: playbookId,
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
      <HeadlineCarousel />

      <Composer
        value={goal}
        onChange={setGoal}
        onSubmit={handleSubmit}
        projectId={projectId}
        playbookId={playbookId}
        onProjectChange={setProjectId}
        onPlaybookChange={setPlaybookId}
        submitting={submitting}
        error={error}
      />
      <SuggestionChips onPick={setGoal} />
    </div>
  );
}
