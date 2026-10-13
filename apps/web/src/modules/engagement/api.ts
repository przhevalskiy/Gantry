import { gantryClient } from '@/modules/kernel';
import type { JobComposerIntent } from './types';

export async function fileJob(intent: Extract<JobComposerIntent, { type: 'file' }>) {
  if (intent.playbook || intent.pack) {
    return gantryClient.runPlaybook({
      goal: intent.goal,
      project_id: intent.workspaceId,
      playbook: intent.playbook,
      pack: intent.pack,
      tier: intent.tier,
    });
  }
  return gantryClient.submitTask({
    goal: intent.goal,
    workspace_id: intent.workspaceId,
    tier: intent.tier,
  });
}

export async function steerJob(intent: Extract<JobComposerIntent, { type: 'followup' | 'amend' }>) {
  return gantryClient.sendFollowUp(intent.taskId, intent.prompt);
}
