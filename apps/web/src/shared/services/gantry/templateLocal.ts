import type { Template, TemplateCreate, TemplateUpdate } from '@/shared/types';

const KEY = 'gantry_starters_v1';
const LEGACY_KEY = 'gantry_templates_v1';

function migrateLegacy(): void {
  if (localStorage.getItem(KEY)) return;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return;
  localStorage.setItem(KEY, legacy);
  localStorage.removeItem(LEGACY_KEY);
}

function load(): Template[] {
  migrateLegacy();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Template[]) : [];
  } catch {
    return [];
  }
}

function save(rows: Template[]): void {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

function now(): string {
  return new Date().toISOString();
}

export const templateLocal = {
  list(): Template[] {
    return load();
  },

  create(data: TemplateCreate): Template {
    const row: Template = {
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description ?? null,
      body: data.body,
      hubspace_id: data.hubspace_id ?? null,
      icon: data.icon ?? null,
      color: data.color ?? null,
      created_at: now(),
      updated_at: now(),
    };
    const rows = [row, ...load()];
    save(rows);
    return row;
  },

  update(id: string, data: TemplateUpdate): Template {
    const rows = load();
    const idx = rows.findIndex(t => t.id === id);
    if (idx < 0) throw new Error('starter not found');
    rows[idx] = { ...rows[idx], ...data, updated_at: now() };
    save(rows);
    return rows[idx];
  },

  delete(id: string): void {
    save(load().filter(t => t.id !== id));
  },
};
