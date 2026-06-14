import { NextRequest, NextResponse } from 'next/server';

const GANTRY_API_URL = process.env.GANTRY_API_URL ?? '';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId');
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  if (!GANTRY_API_URL) return NextResponse.json({ build: null });

  const res = await fetch(
    `${GANTRY_API_URL}/internal/db/tasks/${encodeURIComponent(taskId)}/build`,
    {
      headers: INTERNAL_API_KEY ? { 'x-internal-key': INTERNAL_API_KEY } : {},
      next: { revalidate: 0 },
    },
  );
  if (!res.ok) return NextResponse.json({ build: null });
  return NextResponse.json(await res.json());
}
