import { NextRequest, NextResponse } from 'next/server';

const GANTRY_API_URL = process.env.GANTRY_API_URL ?? '';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';

// In production (GANTRY_API_URL set), proxy to the worker machine's FastAPI.
// In local dev, read directly from the local filesystem.
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'missing path' }, { status: 400 });

  if (GANTRY_API_URL) {
    const url = `${GANTRY_API_URL}/internal/files/content?path=${encodeURIComponent(path)}`;
    const res = await fetch(url, {
      headers: INTERNAL_API_KEY ? { 'x-internal-key': INTERNAL_API_KEY } : {},
      next: { revalidate: 0 },
    });
    if (!res.ok) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(await res.json());
  }

  // Local dev fallback
  try {
    const { readFileSync } = await import('fs');
    const content = readFileSync(path, 'utf-8');
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
