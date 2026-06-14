import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { auth } from '@clerk/nextjs/server';

export interface Project {
  id: string;
  name: string;
  slug: string;
  repo_path: string;
  created_at: string;
  github_url?: string;
  github_owner?: string;
  github_repo?: string;
}

const GANTRY_API_URL = process.env.GANTRY_API_URL ?? '';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';

async function getUserId(): Promise<string> {
  try {
    const { userId } = await auth();
    return userId ?? 'system';
  } catch {
    return 'system';
  }
}

function dbHeaders(userId: string) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    ...(INTERNAL_API_KEY ? { 'x-internal-key': INTERNAL_API_KEY } : {}),
  };
}

// ── Production: proxy to FastAPI DB ──────────────────────────────────────────

export async function GET() {
  if (GANTRY_API_URL) {
    const userId = await getUserId();
    const res = await fetch(`${GANTRY_API_URL}/internal/db/projects`, {
      headers: dbHeaders(userId),
      next: { revalidate: 0 },
    });
    if (!res.ok) return NextResponse.json({ projects: [] });
    return NextResponse.json(await res.json());
  }
  // ── Local dev fallback: registry.json ─────────────────────────────────────
  return NextResponse.json({ projects: loadRegistry() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (GANTRY_API_URL) {
    const userId = await getUserId();
    const res = await fetch(`${GANTRY_API_URL}/internal/db/projects`, {
      method: 'POST',
      headers: dbHeaders(userId),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data, { status: 201 });
  }
  return localPost(body);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (GANTRY_API_URL) {
    const userId = await getUserId();
    const res = await fetch(`${GANTRY_API_URL}/internal/db/projects/${id}`, {
      method: 'PATCH',
      headers: dbHeaders(userId),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  }
  return localPatch(id, updates);
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id, taskIds = [] } = body as { id: string; taskIds: string[] };
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (GANTRY_API_URL) {
    const userId = await getUserId();
    const res = await fetch(`${GANTRY_API_URL}/internal/db/projects/${id}`, {
      method: 'DELETE',
      headers: dbHeaders(userId),
    });
    if (!res.ok) return NextResponse.json({ error: 'delete failed' }, { status: res.status });
    // Still terminate Temporal workflows locally
    await terminateWorkflows(taskIds);
    return NextResponse.json({ deleted: id });
  }
  return localDelete(id, taskIds);
}

// ── Local dev helpers (registry.json) ────────────────────────────────────────

function getBase(): string {
  return process.env.GANTRY_FILES_BASE ?? join(os.homedir(), '.gantry', 'projects');
}
function getRegistryPath() { return join(getBase(), 'registry.json'); }
function loadRegistry(): Project[] {
  const p = getRegistryPath();
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, 'utf-8')) as Project[]; } catch { return []; }
}
function saveRegistry(projects: Project[]) {
  mkdirSync(getBase(), { recursive: true });
  writeFileSync(getRegistryPath(), JSON.stringify(projects, null, 2));
}
function toSlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function parseGithubUrl(url: string) {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

function localPost(body: Record<string, unknown>) {
  const name = ((body.name as string) ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  const github_url = ((body.github_url as string) ?? '').trim();
  const projects = loadRegistry();
  let slug = toSlug(name);
  const taken = new Set(projects.map(p => p.slug));
  let n = 2;
  while (taken.has(slug)) slug = `${toSlug(name)}-${n++}`;
  const repo_path = join(getBase(), slug);
  if (!github_url) mkdirSync(repo_path, { recursive: true });
  const parsed = github_url ? parseGithubUrl(github_url) : null;
  const project: Project = {
    id: randomUUID(), name, slug, repo_path,
    created_at: new Date().toISOString(),
    ...(github_url ? { github_url, github_owner: parsed?.owner, github_repo: parsed?.repo } : {}),
  };
  projects.push(project);
  saveRegistry(projects);
  return NextResponse.json({ project }, { status: 201 });
}

function localPatch(id: string, updates: Record<string, unknown>) {
  const projects = loadRegistry();
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (updates.github_url) {
    const parsed = parseGithubUrl(updates.github_url as string);
    updates.github_owner = parsed?.owner;
    updates.github_repo = parsed?.repo;
  }
  projects[idx] = { ...projects[idx], ...updates } as Project;
  saveRegistry(projects);
  return NextResponse.json({ project: projects[idx] });
}

async function terminateWorkflows(taskIds: string[]) {
  if (!taskIds.length) return [];
  const temporal = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const ns = process.env.TEMPORAL_NAMESPACE ?? 'default';
  const terminated: string[] = [];
  for (const taskId of taskIds) {
    try {
      const { execSync } = await import('child_process');
      execSync(
        `temporal workflow terminate --workflow-id "${taskId}" --namespace "${ns}" --reason "project deleted" 2>/dev/null || true`,
        { env: { ...process.env, TEMPORAL_ADDRESS: temporal }, timeout: 5000 },
      );
      terminated.push(taskId);
    } catch { /* non-fatal */ }
  }
  return terminated;
}

async function localDelete(id: string, taskIds: string[]) {
  const projects = loadRegistry();
  const project = projects.find(p => p.id === id);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  saveRegistry(projects.filter(p => p.id !== id));
  if (project.repo_path) {
    try {
      const { rmSync, existsSync: fsExists } = await import('fs');
      if (fsExists(project.repo_path)) rmSync(project.repo_path, { recursive: true, force: true });
    } catch { /* non-fatal */ }
  }
  const terminatedWorkflows = await terminateWorkflows(taskIds);
  return NextResponse.json({ deleted: id, terminatedWorkflows });
}
