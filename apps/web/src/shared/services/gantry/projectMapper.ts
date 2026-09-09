import type { Project } from '@/shared/types';
import type { GantryProject } from './client';

const NOTES_KEY = 'gantry_project_notes_v1';

function loadNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveNotes(notes: Record<string, string>): void {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export const projectNotesLocal = {
  get(projectId: string): string | null {
    return loadNotes()[projectId] ?? null;
  },

  set(projectId: string, notes: string | null): void {
    const all = loadNotes();
    if (notes?.trim()) {
      all[projectId] = notes.trim();
    } else {
      delete all[projectId];
    }
    saveNotes(all);
  },
};

export function toQodexProject(row: GantryProject): Project {
  const created = row.created_at ?? new Date().toISOString();
  const notes = projectNotesLocal.get(row.id);
  return {
    id: row.id,
    name: row.name,
    repo_path: row.repo_path ?? null,
    github_url: row.github_url ?? null,
    github_owner: row.github_owner ?? null,
    github_repo: row.github_repo ?? null,
    instructions: notes,
    created_at: created,
    updated_at: created,
  };
}
