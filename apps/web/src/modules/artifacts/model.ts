import type { GantryTask } from '@/modules/kernel';
import type { Deliverable } from './types';

/** Project structured task result into a Deliverable for ArtifactDock. */
export function deliverableFromTaskResult(task: GantryTask): Deliverable | null {
  const result = task.result;
  if (!result) return null;
  if (result.pr_url) {
    return {
      kind: 'pr',
      taskId: task.task_id,
      title: 'Pull request',
      url: result.pr_url,
      branch: result.branch ?? null,
    };
  }
  if (result.branch) {
    return {
      kind: 'branch',
      taskId: task.task_id,
      title: 'Branch',
      branch: result.branch,
    };
  }
  return {
    kind: 'unknown',
    taskId: task.task_id,
    title: 'Deliverable',
  };
}
