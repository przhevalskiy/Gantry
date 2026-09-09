/** Default run settings applied to every factory task submit. */
export type PipelineDefaults = {
  tier: number;
  /** Playbook id from runConfig.PLAYBOOK_OPTIONS, or empty for general runs. */
  playbook: string;
  max_parallel_tracks?: number;
  max_heal_cycles?: number;
  lightweight_mode?: boolean;
  disable_agents: string[];
};

const KEY = 'gantry_pipeline_defaults_v1';

export const DISABLEABLE_AGENTS = [
  { id: 'pm', label: 'Project lead', description: 'Clarifies the goal before work starts' },
  { id: 'reviewer', label: 'Code reviewer', description: 'Checks the final changes make sense' },
  { id: 'security', label: 'Security check', description: 'Scans for secrets and risky patterns' },
  { id: 'inspector', label: 'Quality check', description: 'Runs tests and fixes common failures' },
] as const;

const DEFAULTS: PipelineDefaults = {
  tier: -1,
  playbook: 'platform-backlog',
  disable_agents: [],
};

export function getPipelineDefaults(): PipelineDefaults {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PipelineDefaults>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePipelineDefaults(next: PipelineDefaults): void {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function pipelinePayload(defaults: PipelineDefaults): Record<string, unknown> | undefined {
  const pipeline: Record<string, unknown> = {};
  if (defaults.tier >= 0) pipeline.tier = defaults.tier;
  if (defaults.max_parallel_tracks != null) pipeline.max_parallel_tracks = defaults.max_parallel_tracks;
  if (defaults.max_heal_cycles != null) pipeline.max_heal_cycles = defaults.max_heal_cycles;
  if (defaults.lightweight_mode != null) pipeline.lightweight_mode = defaults.lightweight_mode;
  if (defaults.disable_agents.length > 0) pipeline.disable_agents = defaults.disable_agents;
  return Object.keys(pipeline).length > 0 ? pipeline : undefined;
}
