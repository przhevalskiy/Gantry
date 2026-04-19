import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AgentModel = 'claude-sonnet-4-6' | 'claude-haiku-4-5' | 'default';

export type AgentConfig = {
  // Research pipeline
  maxAnalysts: number;          // 2–8
  maxVerifiers: number;         // 1–5
  analystDepth: 'shallow' | 'deep';

  // Execution pipeline
  requireApprovalForIrreversible: boolean;
  maxExecutionSteps: number;    // 1–20
  httpTimeoutSeconds: number;   // 10–120

  // Model overrides per role
  modelStrategist: AgentModel;
  modelCritic: AgentModel;
  modelTaskPlanner: AgentModel;
  modelAnalyst: AgentModel;
  modelScout: AgentModel;
  modelVerifier: AgentModel;

  // Display
  showAgentTagsInFeed: boolean;
  showRawClaimsBeforeSynthesis: boolean;
};

export const DEFAULT_CONFIG: AgentConfig = {
  maxAnalysts: 5,
  maxVerifiers: 3,
  analystDepth: 'deep',
  requireApprovalForIrreversible: false,
  maxExecutionSteps: 10,
  httpTimeoutSeconds: 30,
  modelStrategist: 'default',
  modelCritic: 'default',
  modelTaskPlanner: 'default',
  modelAnalyst: 'default',
  modelScout: 'default',
  modelVerifier: 'default',
  showAgentTagsInFeed: false,
  showRawClaimsBeforeSynthesis: false,
};

type AgentConfigStore = {
  config: AgentConfig;
  setConfig: (patch: Partial<AgentConfig>) => void;
  resetConfig: () => void;
  isDirty: () => boolean;
};

export const useAgentConfigStore = create<AgentConfigStore>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      setConfig: (patch) => set(s => ({ config: { ...s.config, ...patch } })),
      resetConfig: () => set({ config: DEFAULT_CONFIG }),
      isDirty: () => {
        const c = get().config;
        return (Object.keys(DEFAULT_CONFIG) as (keyof AgentConfig)[]).some(
          k => c[k] !== DEFAULT_CONFIG[k]
        );
      },
    }),
    { name: 'oumuamua_agent_config' }
  )
);
