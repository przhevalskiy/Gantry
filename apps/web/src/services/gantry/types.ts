/** Minimal types for later /v1 slices — keep in sync with docs/api.md. */

export type ArtifactType = "pr" | "branch" | "patch" | "report";

export interface TaskResult {
  pr_url?: string;
  branch?: string;
  artifact_type?: ArtifactType;
  [key: string]: unknown;
}

export interface Task {
  task_id: string;
  status: string;
  project_id?: string;
  goal?: string;
  result?: TaskResult | null;
  pending_hitl?: unknown[];
}

export interface AgentSeat {
  name: string;
  role: string;
  description?: string;
  level?: string;
}
