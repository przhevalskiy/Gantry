export type Practice = {
  id: string;
  name?: string;
  version?: string;
  enabled?: boolean;
  description?: string;
  maxTasksPerDay?: number;
  raw: Record<string, unknown>;
};
