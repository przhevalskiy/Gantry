import { gantryClient } from '@/modules/kernel';
import type { Brief } from './types';

function toBrief(playbook: Record<string, unknown>): Brief {
  return {
    id: String(playbook.id ?? playbook.slug ?? ''),
    slug: typeof playbook.slug === 'string' ? playbook.slug : undefined,
    name: typeof playbook.name === 'string' ? playbook.name : undefined,
    description: typeof playbook.description === 'string' ? playbook.description : undefined,
    pack: typeof playbook.pack === 'string' ? playbook.pack : undefined,
    raw: playbook,
  };
}

export async function listBriefs(workspaceId?: string): Promise<Brief[]> {
  const playbooks = await gantryClient.listPlaybooks(workspaceId);
  return playbooks.map(p => toBrief(p as unknown as Record<string, unknown>));
}

export async function runBrief(body: {
  goal: string;
  workspaceId: string;
  playbook?: string;
  pack?: string;
  tier?: number;
}) {
  return gantryClient.runPlaybook({
    goal: body.goal,
    project_id: body.workspaceId,
    playbook: body.playbook,
    pack: body.pack,
    tier: body.tier,
  });
}
