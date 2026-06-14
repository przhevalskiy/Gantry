export interface FactEntry {
  value: string;
  agent: string;
  confidence: number;
  updated_at: string;
}

export interface Episode {
  timestamp: string;
  goal?: string;
  outcome?: string;
  tier_label?: string;
  tier?: string | number;
  quality_score?: number;
  heal_cycles?: number;
  key_decisions?: string[];
  repo_path?: string;
  pr_url?: string;
}

export interface MemoryData {
  project_id: string;
  repo_path: string;
  facts: Record<string, FactEntry | string>;
  episodes: Episode[];
  facts_count: number;
  episodes_count: number;
}
