/**
 * Kernel API facade — re-exports gantry transport until absorbed.
 * Domains should prefer their own api.ts; cross-cutting calls live here.
 */
export { gantryClient } from '@/shared/services/gantry/client';
export type {
  GantryTask,
  GantryTaskSummary,
  AgentCatalog,
  CrewAgent,
  AutonomyTier,
} from '@/shared/services/gantry/client';
