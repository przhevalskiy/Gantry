import { ChatRequest, SSEEvent } from '../types';
import { gantryClient, type PipelineConfig } from './gantry/client';
import { playbookLabel, runSizeLabel } from '@/shared/constants/runConfig';
import { getPipelineDefaults, pipelinePayload } from './gantry/pipelineDefaults';
import { getGithubToken } from './gantry/userSettings';
import { discussionLocal } from './gantry/discussionLocal';
import { streamGantryTask } from './gantry/gantryStream';

export class SSEClient {
  private abortController: AbortController | null = null;

  async *streamChat(request: ChatRequest): AsyncGenerator<SSEEvent, void, unknown> {
    this.cancel();
    this.abortController = new AbortController();

    try {
      const discussion = discussionLocal.get(request.discussion_id);
      let projectId = discussion?.project_id ?? null;

      if (!projectId) {
        const projects = await gantryClient.listProjects();
        if (projects.length === 0) {
          yield {
            type: 'error',
            error: 'Create a Hubspace (project) before submitting a factory run.',
            provider: 'gantry',
          };
          return;
        }
        projectId = projects[0].id;
        discussionLocal.update(request.discussion_id, { project_id: projectId });
      }

      yield {
        type: 'intent',
        intent: 'factory_run',
        label: 'Factory run',
      };

      const defaults = getPipelineDefaults();
      const pipeline = pipelinePayload(defaults);
      const playbook = defaults.playbook || undefined;

      const { task_id } = await gantryClient.submitTask({
        goal: request.message,
        project_id: projectId,
        tier: defaults.tier,
        ...(playbook ? { playbook } : {}),
        ...(pipeline ? { pipeline: pipeline as PipelineConfig } : {}),
        ...(getGithubToken() ? { github_token: getGithubToken() } : {}),
      });

      discussionLocal.setTaskId(request.discussion_id, task_id);
      window.dispatchEvent(new CustomEvent('gantry:task-submitted', { detail: { task_id } }));

      const profileParts = [
        runSizeLabel(defaults.tier),
        playbook ? playbookLabel(playbook) : null,
      ].filter(Boolean);

      yield {
        type: 'submitted',
        hive_task_id: task_id,
        message: `Run started (${profileParts.join(' · ')}) — task ${task_id}`,
      };

      yield* streamGantryTask(task_id);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      yield {
        type: 'error',
        error: (error as Error).message,
        provider: 'gantry',
      };
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  isActive(): boolean {
    return this.abortController !== null && !this.abortController.signal.aborted;
  }
}

export const sseClient = new SSEClient();
