import { gantryClient } from '@/modules/kernel';
import type { HitlCheckpoint, HitlDecision } from './types';

export async function submitHitlDecision(checkpoint: HitlCheckpoint, decision: HitlDecision) {
  return gantryClient.hitl(checkpoint.taskId, {
    checkpoint: checkpoint.checkpoint,
    workflow_id: checkpoint.workflowId,
    approved: decision.approved,
    signal: decision.signal,
    payload: decision.payload,
  });
}
