/** Types aligned with docs/api.md — keep thin; no orchestration models. */

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
  org_id?: string;
  goal?: string;
  tier?: number;
  autonomy_level?: string;
  playbook?: string | null;
  result?: TaskResult | null;
  pending_hitl?: unknown[];
  created_at?: string;
  updated_at?: string;
}

export interface SubmitTaskBody {
  goal: string;
  project_id: string;
  tier?: number;
  playbook?: string | null;
  branch_prefix?: string;
}

export interface SubmitTaskResponse {
  task_id: string;
  status: string;
  project_id: string;
  org_id?: string;
  autonomy_level?: string | null;
  idempotent?: boolean;
}

export interface Project {
  id: string;
  name: string;
  github_url?: string | null;
  org_id?: string;
  created_at?: string;
}

export interface AgentSeat {
  name: string;
  role: string;
  description?: string;
  level?: string;
}

export class GantryApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "GantryApiError";
    this.status = status;
    this.detail = detail;
  }
}
