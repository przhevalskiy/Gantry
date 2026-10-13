import { gantryClient, type GantryTaskSummary } from '@/modules/kernel';
import type { MatterSummary } from './types';

export function toMatterSummary(task: GantryTaskSummary): MatterSummary {
  return {
    id: task.task_id,
    status: task.status,
    goal: task.goal,
    playbook: task.playbook,
    workspaceId: task.project_id,
    tier: task.tier,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    hasArtifact: Boolean(task.result?.pr_url || task.result?.branch),
  };
}

export async function listMatters(limit = 50): Promise<MatterSummary[]> {
  const { tasks } = await gantryClient.listTasks(limit);
  return tasks.map(toMatterSummary);
}
