import { gantryClient } from '@/modules/kernel';
import type { Practice } from './types';

function toPractice(pack: Record<string, unknown>): Practice {
  return {
    id: String(pack.id ?? pack.pack_id ?? pack.slug ?? ''),
    name: typeof pack.name === 'string' ? pack.name : undefined,
    version: typeof pack.version === 'string' ? pack.version : undefined,
    enabled: typeof pack.enabled === 'boolean' ? pack.enabled : undefined,
    description: typeof pack.description === 'string' ? pack.description : undefined,
    maxTasksPerDay:
      typeof pack.max_tasks_per_day === 'number' ? pack.max_tasks_per_day : undefined,
    raw: pack,
  };
}

export async function listPractices(): Promise<Practice[]> {
  const packs = await gantryClient.listPacks();
  return packs.map(p => toPractice(p as Record<string, unknown>));
}

export async function retainPractice(packId: string, opts?: { version?: string; max_tasks_per_day?: number }) {
  return gantryClient.installPack(packId, opts);
}

export async function setPracticeEnabled(packId: string, enabled: boolean) {
  return gantryClient.updatePack(packId, { enabled });
}
