import { gantryClient } from './client';
import { discussionLocal } from './discussionLocal';

export async function approveFactoryHitl(
  discussionId: string,
  fields: Record<string, string>,
  approved: boolean,
): Promise<void> {
  const taskId = discussionLocal.getTaskId(discussionId);
  if (!taskId) {
    throw new Error('No factory run linked to this conversation');
  }

  const checkpoint = fields.checkpoint;
  const workflow_id = fields.workflow_id;
  if (!checkpoint || !workflow_id) {
    throw new Error('Missing HITL checkpoint metadata');
  }

  await gantryClient.hitl(taskId, { checkpoint, workflow_id, approved });
}
