import { gantryClient } from '@/modules/kernel';
import type { OperatorSeat } from './types';

/** Load crew catalog for People directory / floor preview. */
export async function loadOperatorCatalog(): Promise<{
  agents: Awaited<ReturnType<typeof gantryClient.listAgents>>;
}> {
  const agents = await gantryClient.listAgents();
  return { agents };
}

/**
 * Map catalog agents to ghost seats for L5 floor preview.
 * Live presence is applied later from SSE/traces (G0+).
 */
export function catalogToGhostSeats(
  catalog: Awaited<ReturnType<typeof gantryClient.listAgents>>,
): OperatorSeat[] {
  return catalog.agents.map(a => ({
    roleId: a.role || a.name,
    title: a.name,
    description: a.description,
    presence: 'ghost' as const,
  }));
}
