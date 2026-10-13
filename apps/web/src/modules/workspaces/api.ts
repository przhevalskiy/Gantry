import { gantryClient, type GantryWorkspace } from '@/shared/services/gantry/client';

export type { GantryWorkspace };

export async function listWorkspaces() {
  return gantryClient.listWorkspaces();
}

export async function getWorkspace(id: string) {
  return gantryClient.getWorkspace(id);
}
