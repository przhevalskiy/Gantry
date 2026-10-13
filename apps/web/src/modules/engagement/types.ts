/** Atomic unit of the engagement feed — not ChatMessage as domain model. */
export type EngagementEventKind =
  | 'firm' // Foreman / firm turn
  | 'operator' // attributed Operator log line
  | 'lifecycle' // stage / status milestone
  | 'hitl' // pending approval (render HitlCard)
  | 'artifact' // deliverable card
  | 'system' // errors / stream notices
  | 'user'; // principal steering

export type EngagementEvent = {
  id: string;
  kind: EngagementEventKind;
  at: string;
  body?: string;
  /** Operator roleId when kind === 'operator'. */
  operatorRoleId?: string;
  /** HITL checkpoint payload ref when kind === 'hitl'. */
  hitlCheckpoint?: string;
  hitlWorkflowId?: string;
  /** Artifact / result stub when kind === 'artifact'. */
  artifactRef?: string;
  meta?: Record<string, unknown>;
};

export type JobComposerIntent =
  | { type: 'file'; goal: string; workspaceId: string; playbook?: string; pack?: string; tier?: number }
  | { type: 'followup'; taskId: string; prompt: string }
  | { type: 'amend'; taskId: string; prompt: string };
