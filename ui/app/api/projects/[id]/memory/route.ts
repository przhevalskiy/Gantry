import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

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

interface Project {
  id: string;
  repo_path: string;
  name: string;
  slug: string;
  created_at: string;
}

function loadRegistry(): Project[] {
  const base = process.env.GANTRY_FILES_BASE ?? join(os.homedir(), '.gantry', 'projects');
  const p = join(base, 'registry.json');
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as Project[];
  } catch {
    return [];
  }
}

function readJsonl(path: string): object[] {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, 'utf-8')
      .split('\n')
      .filter(l => l.trim())
      .map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Production: proxy to FastAPI which reads from worker disk
  if (GANTRY_API_URL) {
    const userId = await getUserId();
    const res = await fetch(`${GANTRY_API_URL}/internal/projects/${id}/memory`, {
      headers: {
        'x-user-id': userId,
        ...(INTERNAL_API_KEY ? { 'x-internal-key': INTERNAL_API_KEY } : {}),
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return NextResponse.json({ error: 'project not found' }, { status: res.status });
    return NextResponse.json(await res.json());
  }

  // Local dev: read from filesystem directly
  const projects = loadRegistry();
  const project = projects.find(p => p.id === id);
  if (!project) {
    return NextResponse.json({ error: 'project not found' }, { status: 404 });
  }

  const memDir = join(project.repo_path, '.gantry', 'memory');
  const factsPath = join(memDir, 'facts.json');
  const episodesPath = join(memDir, 'episodes.jsonl');

  let facts: Record<string, unknown> = {};
  if (existsSync(factsPath)) {
    try {
      facts = JSON.parse(readFileSync(factsPath, 'utf-8'));
    } catch {
      facts = {};
    }
  }

  const allEpisodes = readJsonl(episodesPath);
  const episodes = allEpisodes.slice(-20).reverse();

  return NextResponse.json({
    project_id: id,
    repo_path: project.repo_path,
    facts,
    episodes,
    facts_count: Object.keys(facts).length,
    episodes_count: allEpisodes.length,
  });
}
