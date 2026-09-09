import { HttpClient } from './http';
import {
  Task, Project,
  SubmitTaskOptions, CreateProjectOptions, UpdateProjectOptions, WaitOptions,
  BulkSubmitOptions, BulkResponse,
  isTerminal,
} from './types';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class Tasks {
  constructor(private readonly http: HttpClient) {}

  async submit(
    goal: string,
    projectId: string,
    options: SubmitTaskOptions = {},
  ): Promise<Task> {
    return this.http.post<Task>('/v1/tasks', {
      goal,
      project_id: projectId,
      branch_prefix: options.branch_prefix ?? 'swarm',
      tier: options.tier ?? -1,
      ...(options.playbook ? { playbook: options.playbook } : {}),
      ...(options.github_token ? { github_token: options.github_token } : {}),
      ...(options.webhook_url ? { webhook_url: options.webhook_url } : {}),
    });
  }

  async get(taskId: string): Promise<Task> {
    return this.http.get<Task>(`/v1/tasks/${taskId}`);
  }

  async messages(taskId: string): Promise<unknown[]> {
    const data = await this.http.get<{ messages: unknown[] }>(`/v1/tasks/${taskId}/messages`);
    return data.messages;
  }

  async wait(taskId: string, options: WaitOptions = {}): Promise<Task> {
    const timeout = options.timeout ?? 1800_000;
    const interval = options.pollInterval ?? 10_000;
    const deadline = Date.now() + timeout;

    while (true) {
      const task = await this.get(taskId);
      if (isTerminal(task.status)) return task;

      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error(`Task ${taskId} did not complete within ${timeout}ms`);
      }
      await sleep(Math.min(interval, remaining));
    }
  }

  async bulk(
    goals: string[],
    projectId: string,
    options: BulkSubmitOptions = {},
  ): Promise<BulkResponse> {
    return this.http.post<BulkResponse>('/v1/tasks/bulk', {
      project_id: projectId,
      tasks: goals.map(goal => ({ goal })),
      branch_prefix: options.branch_prefix ?? 'swarm',
      tier: options.tier ?? -1,
      ...(options.playbook ? { playbook: options.playbook } : {}),
      ...(options.github_token ? { github_token: options.github_token } : {}),
      ...(options.webhook_url ? { webhook_url: options.webhook_url } : {}),
    });
  }

  async terminate(taskId: string): Promise<void> {
    return this.http.delete(`/v1/tasks/${taskId}`);
  }

  async approve(taskId: string, workflowId?: string): Promise<void> {
    await this.http.post(`/v1/tasks/${taskId}/approve`, {
      workflow_id: workflowId ?? taskId,
      approved: true,
    });
  }

  async hitl(
    taskId: string,
    options: {
      checkpoint: string;
      workflowId: string;
      approved?: boolean;
      payload?: boolean | Record<string, unknown>;
    },
  ): Promise<{ ok: boolean; checkpoint: string; acp_event: string }> {
    return this.http.post(`/v1/tasks/${taskId}/hitl`, {
      checkpoint: options.checkpoint,
      workflow_id: options.workflowId,
      ...(options.payload !== undefined ? { payload: options.payload } : {}),
      ...(options.approved !== undefined ? { approved: options.approved } : {}),
    });
  }

  async *streamEvents(taskId: string): AsyncGenerator<Record<string, unknown>, void, unknown> {
    yield* this.http.streamSSE(`/v1/tasks/${encodeURIComponent(taskId)}/events`);
  }
}

export class Agents {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<unknown> {
    return this.http.get('/v1/agents');
  }

  async get(name: string): Promise<unknown> {
    return this.http.get(`/v1/agents/${name}`);
  }
}

export class Projects {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<Project[]> {
    const data = await this.http.get<{ projects: Project[] }>('/v1/projects');
    return data.projects;
  }

  async get(projectId: string): Promise<Project> {
    const data = await this.http.get<{ project: Project }>(`/v1/projects/${projectId}`);
    return data.project;
  }

  async create(name: string, options: CreateProjectOptions = {}): Promise<Project> {
    return this.http.post<Project>('/v1/projects', {
      name,
      ...(options.github_url ? { github_url: options.github_url } : {}),
    });
  }

  async update(projectId: string, options: UpdateProjectOptions): Promise<Project> {
    return this.http.patch<Project>(`/v1/projects/${projectId}`, options);
  }
}
