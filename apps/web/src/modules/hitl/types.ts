export type HitlCheckpoint = {
  checkpoint: string;
  workflowId: string;
  description?: string;
  questions?: string[];
  taskId: string;
};

export type HitlDecision = {
  approved: boolean;
  signal?: string;
  payload?: boolean | Record<string, unknown>;
};
