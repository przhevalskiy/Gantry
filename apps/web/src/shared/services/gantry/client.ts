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

/** Workspace record from GET /v1/workspaces (backed by projects table). */
export type GantryWorkspace = {
  id: string;
  name: string;
  slug?: string;
  repo_path?: string;
  github_url?: string | null;
  github_owner?: string | null;
  github_repo?: string | null;
  instructions?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** @deprecated Use GantryWorkspace */
export type GantryProject = GantryWorkspace;

export type GantryArtifact = {
  id: string;
  project_id: string;
  workspace_id?: string;
  task_id?: string | null;
  scope: 'run' | 'workspace';
  filename: string;
  content_type: string;
  size_bytes: number;
  text_extract?: string | null;
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

  listPlaybooks: (workspaceId?: string) =>
    request<{ playbooks: import('@/shared/types').Playbook[] }>(
      `/v1/playbooks${workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''}`,
    ).then(r => r.playbooks),

  createPlaybook: (body: import('@/shared/types').PlaybookCreate) =>
    request<{ playbook: import('@/shared/types').Playbook }>('/v1/playbooks', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then(r => r.playbook),

  updatePlaybook: (id: string, body: Partial<import('@/shared/types').PlaybookCreate>) =>
    request<{ playbook: import('@/shared/types').Playbook }>(
      `/v1/playbooks/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ).then(r => r.playbook),

  deletePlaybook: (id: string) =>
    request<void>(`/v1/playbooks/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listPacks: () =>
    request<{ packs: Record<string, unknown>[] }>('/v1/packs').then(r => r.packs),

  getPack: (packId: string) =>
    request<{ pack: Record<string, unknown> }>(`/v1/packs/${encodeURIComponent(packId)}`).then(
      r => r.pack,
    ),

  installPack: (packId: string, body?: { version?: string; max_tasks_per_day?: number }) =>
    request<{ pack: Record<string, unknown> }>(
      `/v1/packs/${encodeURIComponent(packId)}/install`,
      { method: 'POST', body: JSON.stringify(body ?? {}) },
    ).then(r => r.pack),

  updatePack: (
    packId: string,
    body: { enabled?: boolean; max_tasks_per_day?: number },
  ) =>
    request<{ pack: Record<string, unknown> }>(`/v1/packs/${encodeURIComponent(packId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }).then(r => r.pack),

  uninstallPack: (packId: string) =>
    request<void>(`/v1/packs/${encodeURIComponent(packId)}`, { method: 'DELETE' }),

  runPlaybook: (body: {
    goal: string;
    project_id: string;
    playbook?: string;
    pack?: string;
    tier?: number;
  }) =>
    request<{ task_id: string; status: string; playbook?: string; pack?: string }>(
      '/v1/playbooks/run',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  listWorkspaces: () =>
    request<{ workspaces: GantryWorkspace[] }>('/v1/workspaces').then(r => r.workspaces),

  getWorkspace: (id: string) =>
    request<{ workspace: GantryWorkspace }>(`/v1/workspaces/${encodeURIComponent(id)}`).then(
      r => r.workspace,
    ),

  createWorkspace: (
    name: string,
    opts?: { github_url?: string; instructions?: string | null },
  ) =>
    request<{ workspace: GantryWorkspace }>('/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify({
        name,
        ...(opts?.github_url ? { github_url: opts.github_url } : {}),
        ...(opts?.instructions ? { instructions: opts.instructions } : {}),
      }),
    }).then(r => r.workspace),

  updateWorkspace: (
    id: string,
    body: { name?: string; github_url?: string; instructions?: string | null },
  ) =>
    request<{ workspace: GantryWorkspace }>(`/v1/workspaces/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }).then(r => r.workspace),

  deleteWorkspace: (id: string) =>
    request<{ deleted: string }>(`/v1/workspaces/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  /** @deprecated Use listWorkspaces */
  listProjects: () =>
    request<{ workspaces: GantryWorkspace[] }>('/v1/workspaces').then(r => r.workspaces),

  /** @deprecated Use getWorkspace */
  getProject: (id: string) =>
    request<{ workspace: GantryWorkspace }>(`/v1/workspaces/${encodeURIComponent(id)}`).then(
      r => r.workspace,
    ),

  /** @deprecated Use createWorkspace */
  createProject: (
    name: string,
    opts?: { github_url?: string; instructions?: string | null },
  ) =>
    request<{ workspace: GantryWorkspace }>('/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify({
        name,
        ...(opts?.github_url ? { github_url: opts.github_url } : {}),
        ...(opts?.instructions ? { instructions: opts.instructions } : {}),
      }),
    }).then(r => r.workspace),

  /** @deprecated Use updateWorkspace */
  updateProject: (
    id: string,
    body: { name?: string; github_url?: string; instructions?: string | null },
  ) =>
    request<{ workspace: GantryWorkspace }>(`/v1/workspaces/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }).then(r => r.workspace),

  listWorkspaceArtifacts: (workspaceId: string, scope?: string) =>
    request<{ artifacts: GantryArtifact[]; count: number }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/artifacts${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`,
    ),

  /** @deprecated Use listWorkspaceArtifacts */
  listProjectArtifacts: (workspaceId: string, scope?: string) =>
    request<{ artifacts: GantryArtifact[]; count: number }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/artifacts${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`,
    ),

  uploadArtifact: async (
    workspaceId: string,
    file: File,
    scope: 'run' | 'workspace' = 'run',
    taskId?: string,
  ) => {
    const key = getApiKey();
    const base = gantryBaseUrl();
    const form = new FormData();
    form.append('workspace_id', workspaceId);
    form.append('file', file);
    form.append('scope', scope);
    if (taskId) form.append('task_id', taskId);
    const response = await fetch(`${base}/v1/artifacts`, {
      method: 'POST',
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      body: form,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
      throw new Error((error as { detail?: string }).detail ?? `HTTP ${response.status}`);
    }
    return response.json() as Promise<{ artifact: GantryArtifact }>;
  },

  listGithubRepos: (q = '') =>
    request<{ repos: GithubRepoSummary[] }>(
      `/v1/github/repos${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    ).then(r => r.repos),

  workspaceFileTree: (workspaceId: string) =>
    request<{ files: string[]; source: string }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/files/tree`,
    ),

  workspaceFileContent: (workspaceId: string, path: string) =>
    request<{ path: string; content: string; source: string }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/files/content?path=${encodeURIComponent(path)}`,
    ),

  saveWorkspaceFile: (workspaceId: string, path: string, content: string) =>
    request<{ path: string; ok: boolean }>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/files/content`,
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
    workspace_id: string;
    playbook?: string;
    tier?: number;
    pipeline?: PipelineConfig;
    github_token?: string;
    artifact_ids?: string[];
    include_workspace_brief?: boolean;
  }) =>
    request<{ task_id: string; status: string }>('/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        branch_prefix: 'swarm',
        tier: body.tier ?? -1,
        goal: body.goal,
        workspace_id: body.workspace_id,
        include_workspace_brief: body.include_workspace_brief ?? true,
        ...(body.artifact_ids?.length ? { artifact_ids: body.artifact_ids } : {}),
        ...(body.playbook ? { playbook: body.playbook } : {}),
        ...(body.pipeline ? { pipeline: body.pipeline } : {}),
        ...(body.github_token ? { github_token: body.github_token } : {}),
      }),
    }),

  submitBulkTasks: (body: {
    workspace_id: string;
    tasks: { goal: string }[];
    playbook?: string;
    tier?: number;
    pipeline?: PipelineConfig;
  }) =>
    request<{ submitted: number; failed: number; results: unknown[] }>('/v1/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify({
        workspace_id: body.workspace_id,
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
    body: {
      checkpoint: string;
      workflow_id: string;
      approved?: boolean;
      signal?: string;
      payload?: boolean | Record<string, unknown>;
    },
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
  result?: { pr_url?: string; branch?: string } | null;
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
  pending_hitl?: Array<{ checkpoint: string; workflow_id: string; description?: string; questions?: string[] }>;
  created_at?: string;
  updated_at?: string;
  result?: { pr_url?: string; branch?: string } | null;
};
