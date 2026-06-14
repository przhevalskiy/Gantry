import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

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

export async function GET() {
  if (!GANTRY_API_URL) return NextResponse.json({ active_project_id: null, last_task_id: null });
  const userId = await getUserId();
  const res = await fetch(`${GANTRY_API_URL}/internal/db/preferences`, {
    headers: dbHeaders(userId),
    next: { revalidate: 0 },
  });
  if (!res.ok) return NextResponse.json({ active_project_id: null, last_task_id: null });
  return NextResponse.json(await res.json());
}

export async function PUT(req: NextRequest) {
  if (!GANTRY_API_URL) return NextResponse.json({ ok: false, reason: 'no db' });
  const body = await req.json();
  const userId = await getUserId();
  const res = await fetch(`${GANTRY_API_URL}/internal/db/preferences`, {
    method: 'PUT',
    headers: dbHeaders(userId),
    body: JSON.stringify(body),
  });
  if (!res.ok) return NextResponse.json({ ok: false }, { status: res.status });
  return NextResponse.json({ ok: true });
}
