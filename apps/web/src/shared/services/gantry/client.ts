import { gantryBaseUrl } from './config';
import { getApiKey } from './apiKeyStore';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const key = getApiKey();
  const base = gantryBaseUrl();
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error((error as { detail?: string }).detail ?? `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type GantryProject = {
  id: string;
  name: string;
  slug?: string;
  repo_path?: string;
  github_url?: string | null;
  github_owner?: string | null;
  github_repo?: string | null;
  created_at?: string;
};

export type GithubRepoSummary = {
  id: number;
  full_name: string;
  name: string;
  owner?: string;
  private?: boolean;
  description?: string | null;
  html_url?: string;
  default_branch?: string;
  language?: string | null;
};

export type CrewAgent = {
  name: string;
  role: string;
  workflow: string;
  entrypoint: string;
  level: string;
  description: string;
  tools?: string[];
};

export type AutonomyTier = {
  tier: number;
  label: string;
  level: string;
  max_parallel_tracks: number;
  max_heal_cycles: number;
};

export type AgentCatalog = {
  acp_agent: string;
  orchestration: string;
  agents: CrewAgent[];
  autonomy: AutonomyTier[];
};

export type PipelineConfig = {
  tier?: number;
  max_parallel_tracks?: number;
  max_heal_cycles?: number;
  lightweight_mode?: boolean;
  disable_agents?: string[];
};

export const gantryClient = {
  health: () => request<{ status: string; ok?: boolean; dev_auth_bypass?: boolean }>('/health'),

  listAgents: () => request<AgentCatalog>('/v1/agents'),

  listProjects: () =>
    request<{ projects: GantryProject[] }>('/v1/projects').then(r => r.projects),

  getProject: (id: string) =>
    request<{ project: GantryProject }>(`/v1/projects/${encodeURIComponent(id)}`).then(r => r.project),

  createProject: (name: string, github_url?: string) =>
    request<{ project: GantryProject }>('/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ name, ...(github_url ? { github_url } : {}) }),
    }).then(r => r.project),

  updateProject: (id: string, body: { name?: string; github_url?: string }) =>
    request<{ project: GantryProject }>(`/v1/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }).then(r => r.project),

  listGithubRepos: (q = '') =>
    request<{ repos: GithubRepoSummary[] }>(
      `/v1/github/repos${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    ).then(r => r.repos),

  projectWorkspaceTree: (projectId: string) =>
    request<{ files: string[]; source: string }>(
      `/v1/projects/${encodeURIComponent(projectId)}/files/tree`,
    ),

  projectWorkspaceFile: (projectId: string, path: string) =>
    request<{ path: string; content: string; source: string }>(
      `/v1/projects/${encodeURIComponent(projectId)}/files/content?path=${encodeURIComponent(path)}`,
    ),

  saveProjectWorkspaceFile: (projectId: string, path: string, content: string) =>
    request<{ path: string; ok: boolean }>(
      `/v1/projects/${encodeURIComponent(projectId)}/files/content`,
      {
        method: 'PUT',
        body: JSON.stringify({ path, content }),
      },
    ),

  searchGithubRepos: (body: { q?: string; github_token?: string }) =>
    request<{ repos: GithubRepoSummary[] }>('/v1/github/repos/search', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getTaskMessages: (taskId: string) =>
    request<{ task_id: string; messages: unknown[] }>(
      `/v1/tasks/${encodeURIComponent(taskId)}/messages`,
    ),

  projectGithubTree: (projectId: string, branch = 'main') =>
    request<{ files: string[]; branch: string }>(
      `/v1/github/projects/${encodeURIComponent(projectId)}/tree?branch=${encodeURIComponent(branch)}`,
    ),

  projectGithubFile: (projectId: string, path: string, branch = 'main') =>
    request<{ path: string; content: string; branch: string }>(
      `/v1/github/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(path)}&branch=${encodeURIComponent(branch)}`,
    ),

  submitTask: (body: {
    goal: string;
    project_id: string;
    playbook?: string;
    tier?: number;
    pipeline?: PipelineConfig;
    github_token?: string;
  }) =>
    request<{ task_id: string; status: string }>('/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        branch_prefix: 'swarm',
        tier: body.tier ?? -1,
        goal: body.goal,
        project_id: body.project_id,
        ...(body.playbook ? { playbook: body.playbook } : {}),
        ...(body.pipeline ? { pipeline: body.pipeline } : {}),
        ...(body.github_token ? { github_token: body.github_token } : {}),
      }),
    }),

  submitBulkTasks: (body: {
    project_id: string;
    tasks: { goal: string }[];
    playbook?: string;
    tier?: number;
    pipeline?: PipelineConfig;
  }) =>
    request<{ submitted: number; failed: number; results: unknown[] }>('/v1/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify({
        project_id: body.project_id,
        branch_prefix: 'swarm',
        tier: body.tier ?? -1,
        tasks: body.tasks,
        ...(body.playbook ? { playbook: body.playbook } : {}),
        ...(body.pipeline ? { pipeline: body.pipeline } : {}),
      }),
    }),

  listTasks: (limit = 50) =>
    request<{ tasks: GantryTaskSummary[]; count: number }>(
      `/v1/tasks?limit=${encodeURIComponent(String(limit))}`,
    ),

  hitl: (
    taskId: string,
    body: { checkpoint: string; workflow_id: string; approved?: boolean },
  ) =>
    request<{ ok: boolean }>(`/v1/tasks/${encodeURIComponent(taskId)}/hitl`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  sendFollowUp: (taskId: string, prompt: string) =>
    request<{ ok: boolean }>(`/v1/tasks/${encodeURIComponent(taskId)}/followup`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  terminateTask: (taskId: string) =>
    request<void>(`/v1/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' }),

  getTask: (taskId: string) =>
    request<GantryTask>(`/v1/tasks/${encodeURIComponent(taskId)}`),

  getTaskTraces: (taskId: string) =>
    request<TraceRecord[]>(`/v1/tasks/${encodeURIComponent(taskId)}/traces`),
};

export type TraceRecord = {
  ts: string;
  agent: string;
  turn: number;
  tool: string | null;
  input: string;
  result: string;
  tokens: { input: number; output: number };
  latency_ms: number;
  reasoning: string;
};

export type GantryTaskSummary = {
  task_id: string;
  status: string;
  goal?: string | null;
  project_id?: string | null;
  tier?: number | null;
  playbook?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type GantryTask = {
  task_id: string;
  status: string;
  project_id?: string;
  source?: string;
  tier?: number | null;
  autonomy_level?: string | null;
  playbook?: string | null;
  track_warnings?: string[];
  pending_hitl?: Array<{ checkpoint: string; workflow_id: string; description?: string }>;
  created_at?: string;
  updated_at?: string;
  result?: { pr_url?: string; branch?: string } | null;
};
