import { gantryClient } from '@/modules/kernel';

export async function loadFileTree(workspaceId: string) {
  return gantryClient.workspaceFileTree(workspaceId);
}

export async function loadFileContent(workspaceId: string, path: string) {
  return gantryClient.workspaceFileContent(workspaceId, path);
}
