/** Local discussion store when Gantry has no /api/discussions (M2). */
import type { Discussion, DiscussionCreate, Message, MessageRole } from '@/shared/types';

const KEY = 'gantry_discussions_v1';

function load(): Discussion[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Discussion[]) : [];
  } catch {
    return [];
  }
}

function save(rows: Discussion[]): void {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

function now(): string {
  return new Date().toISOString();
}

export const discussionLocal = {
  list(): Discussion[] {
    return load().sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  },

  get(id: string): Discussion | undefined {
    return load().find(d => d.id === id);
  },

  create(data?: DiscussionCreate): Discussion {
    const row: Discussion = {
      id: crypto.randomUUID(),
      title: data?.title?.trim() || 'New run',
      project_id: data?.project_id ?? null,
      messages: [],
      is_active: true,
      created_at: now(),
      updated_at: now(),
    };
    const rows = [row, ...load()];
    save(rows);
    return row;
  },

  update(id: string, patch: Partial<Pick<Discussion, 'title' | 'project_id' | 'intent' | 'is_active'>>): Discussion {
    const rows = load();
    const idx = rows.findIndex(d => d.id === id);
    if (idx < 0) throw new Error('discussion not found');
    rows[idx] = { ...rows[idx], ...patch, updated_at: now() };
    save(rows);
    return rows[idx];
  },

  delete(id: string): void {
    save(load().filter(d => d.id !== id));
  },

  deleteAll(): number {
    const n = load().length;
    save([]);
    return n;
  },

  addMessage(discussionId: string, content: string, role: MessageRole): Message {
    const rows = load();
    const idx = rows.findIndex(d => d.id === discussionId);
    if (idx < 0) throw new Error('discussion not found');
    const message: Message = {
      id: crypto.randomUUID(),
      content,
      role,
      timestamp: now(),
    };
    rows[idx].messages.push(message);
    rows[idx].updated_at = now();
    save(rows);
    return message;
  },

  setTaskId(discussionId: string, taskId: string): void {
    const rows = load();
    const idx = rows.findIndex(d => d.id === discussionId);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], task_id: taskId, updated_at: now() };
      save(rows);
    }
    localStorage.setItem(`gantry_task_${discussionId}`, taskId);
  },

  getTaskId(discussionId: string): string | null {
    const row = load().find(d => d.id === discussionId);
    return row?.task_id ?? localStorage.getItem(`gantry_task_${discussionId}`);
  },
};
