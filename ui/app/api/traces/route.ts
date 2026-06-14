import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const GANTRY_API_URL = process.env.GANTRY_API_URL ?? '';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';
const GANTRY_HOME = process.env.GANTRY_HOME ?? path.join(process.env.HOME ?? '/tmp', '.gantry');

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get('task_id');
  const repoPath = searchParams.get('repo_path');

  if (!taskId) {
    return NextResponse.json({ error: 'task_id required' }, { status: 400 });
  }

  // Production: proxy to FastAPI on worker machine
  if (GANTRY_API_URL) {
    const params = new URLSearchParams({ task_id: taskId });
    if (repoPath) params.set('repo_path', repoPath);
    const res = await fetch(`${GANTRY_API_URL}/internal/traces?${params}`, {
      headers: INTERNAL_API_KEY ? { 'x-internal-key': INTERNAL_API_KEY } : {},
      next: { revalidate: 0 },
    });
    if (!res.ok) return NextResponse.json([]);
    return NextResponse.json(await res.json());
  }

  // Local dev: read directly from filesystem
  const tracesDir = repoPath
    ? path.join(repoPath, '.gantry', 'traces')
    : path.join(GANTRY_HOME, 'traces');

  const tracePath = path.join(tracesDir, `${taskId}.jsonl`);

  try {
    if (!fs.existsSync(tracePath)) {
      return NextResponse.json([]);
    }

    const raw = fs.readFileSync(tracePath, 'utf-8');
    const records = raw
      .split('\n')
      .filter(Boolean)
      .map(line => {
        try { return JSON.parse(line); }
        catch { return null; }
      })
      .filter(Boolean);

    return NextResponse.json(records);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
