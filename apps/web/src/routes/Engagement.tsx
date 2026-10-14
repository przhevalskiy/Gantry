import { useParams } from "react-router-dom";
import { StubPage } from "./StubPage";

/** Active matter — messaging + floor + HITL (later slices). */
export function Engagement() {
  const { taskId } = useParams();
  return (
    <StubPage
      title="Engagement"
      blurb={`Active run ${taskId ?? "…"}. Foreman thread, Operator floor, HITL cards, artifact climax — SSE via GET /v1/tasks/{id}/events.`}
    />
  );
}
