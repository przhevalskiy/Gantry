export type TaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'terminated'
  | 'timeout';

export interface Task {
  task_id: string;
  status: TaskStatus;
  project_id?: string;
  source?: string;
  pr_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  name: string;
  github_url?: string;
  github_owner?: string;
  github_repo?: string;
  created_at?: string;
}

export interface SubmitTaskOptions {
  branch_prefix?: string;
  tier?: number;
  github_token?: string;
  webhook_url?: string;
}

export interface CreateProjectOptions {
  github_url?: string;
}

export interface UpdateProjectOptions {
  name?: string;
  github_url?: string;
}

export interface WaitOptions {
  timeout?: number;
  pollInterval?: number;
}

export interface BulkTaskItem {
  goal: string;
  branch_prefix?: string;
  tier?: number;
  webhook_url?: string;
}

export interface BulkSubmitOptions {
  branch_prefix?: string;
  tier?: number;
  github_token?: string;
  webhook_url?: string;
}

export interface BulkResult {
  goal: string;
  task_id?: string;
  status?: string;
  error?: string;
}

export interface BulkResponse {
  project_id: string;
  submitted: number;
  failed: number;
  results: BulkResult[];
}

const TERMINAL: Set<TaskStatus> = new Set([
  'completed', 'failed', 'cancelled', 'terminated', 'timeout',
]);

export function isTerminal(status: TaskStatus): boolean {
  return TERMINAL.has(status);
}
