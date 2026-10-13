export type MatterStatus =
  | 'queued'
  | 'running'
  | 'waiting_hitl'
  | 'completed'
  | 'failed'
  | 'terminated'
  | string;

export type MatterSummary = {
  id: string;
  status: MatterStatus;
  goal?: string | null;
  playbook?: string | null;
  workspaceId?: string | null;
  tier?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  hasArtifact?: boolean;
};
