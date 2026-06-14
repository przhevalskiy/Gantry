import { NextRequest, NextResponse } from 'next/server';

const GANTRY_API_URL = process.env.GANTRY_API_URL ?? '';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';

// In production (GANTRY_API_URL set), proxy to the worker machine's FastAPI.
// In local dev, read directly from the local filesystem.
export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root');
  if (!root) return NextResponse.json({ error: 'missing root' }, { status: 400 });

  if (GANTRY_API_URL) {
    const url = `${GANTRY_API_URL}/internal/files/tree?root=${encodeURIComponent(root)}`;
    const res = await fetch(url, {
      headers: INTERNAL_API_KEY ? { 'x-internal-key': INTERNAL_API_KEY } : {},
      next: { revalidate: 0 },
    });
    if (!res.ok) return NextResponse.json({ files: [] });
    return NextResponse.json(await res.json());
  }

  // Local dev fallback
  const { readdirSync, statSync } = await import('fs');
  const { join, relative } = await import('path');
  const SKIP = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '__pycache__', '.venv', 'coverage']);

  function walk(dir: string, root: string, depth = 0): string[] {
    if (depth > 8) return [];
    const out: string[] = [];
    try {
      for (const name of readdirSync(dir).sort()) {
        if (SKIP.has(name) || name.startsWith('.')) continue;
        const full = join(dir, name);
        try {
          const stat = statSync(full);
          if (stat.isDirectory()) out.push(...walk(full, root, depth + 1));
          else out.push(relative(root, full));
        } catch { /* skip unreadable */ }
      }
    } catch { /* dir unreadable */ }
    return out;
  }

  return NextResponse.json({ files: walk(root, root) });
}
