/** Types aligned with docs/api.md — keep thin; no orchestration models. */

export type ArtifactType = "pr" | "branch" | "patch" | "report";

export interface TaskResult {
  pr_url?: string;
  branch?: string;
  artifact_type?: ArtifactType;
  [key: string]: unknown;
}

export interface PendingHitl {
  checkpoint: string;
  workflow_id: string;
  action?: string;
  description?: string;
  questions?: string[];
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
  pending_hitl?: PendingHitl[];
  created_at?: string;
  updated_at?: string;
}

export interface HitlDecideBody {
  checkpoint: string;
  workflow_id: string;
  approved?: boolean;
  payload?: boolean | Record<string, unknown>;
  signal?: string;
}

export interface HitlDecideResponse {
  ok: boolean;
  checkpoint: string;
  acp_event?: string;
  signal?: string;
  workflow?: string;
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

/** SSE payloads from GET /v1/tasks/{id}/events — docs/platform/sse-events.md */
export type TaskSseEventType =
  | "status"
  | "lifecycle"
  | "message"
  | "hitl"
  | "error"
  | "done";

export interface TaskSseMessage {
  id?: string;
  content?: unknown;
  role?: string;
  created_at?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface TaskSseStatusEvent {
  type: "status";
  status: string;
}

export interface TaskSseLifecycleEvent {
  type: "lifecycle";
  event: string;
}

export interface TaskSseMessageEvent {
  type: "message";
  message: TaskSseMessage;
}

export interface TaskSseHitlEvent {
  type: "hitl";
  checkpoint: string;
  workflow_id: string;
  description?: string;
}

export interface TaskSseErrorEvent {
  type: "error";
  message: string;
}

export interface TaskSseDoneEvent {
  type: "done";
  status: string;
  result?: TaskResult | null;
}

export type TaskSseEvent =
  | TaskSseStatusEvent
  | TaskSseLifecycleEvent
  | TaskSseMessageEvent
  | TaskSseHitlEvent
  | TaskSseErrorEvent
  | TaskSseDoneEvent;

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
