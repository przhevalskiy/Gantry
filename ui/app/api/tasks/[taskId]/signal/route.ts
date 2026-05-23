import { NextRequest, NextResponse } from 'next/server';

// In production (Vercel) we cannot reach Temporal's gRPC port directly.
// The Gantry API runs co-located with Temporal on Hetzner and proxies signals.
// In local dev GANTRY_API_URL is unset so we fall back to direct Temporal connection.

const GANTRY_API_URL = process.env.GANTRY_API_URL ?? '';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const body = await req.json();
  const { workflow_id } = body;

  if (!workflow_id) {
    return NextResponse.json({ error: 'workflow_id is required' }, { status: 400 });
  }

  const signalName: string = body.signal ?? 'approve';
  const signalPayload = body.payload !== undefined ? body.payload : body.approved;

  if (signalPayload === undefined) {
    return NextResponse.json({ error: 'signal payload is required' }, { status: 400 });
  }

  // Production path: proxy through Gantry API (co-located with Temporal)
  if (GANTRY_API_URL) {
    try {
      const res = await fetch(`${GANTRY_API_URL}/internal/signal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(INTERNAL_API_KEY ? { 'x-internal-key': INTERNAL_API_KEY } : {}),
        },
        body: JSON.stringify({ workflow_id, signal: signalName, payload: signalPayload }),
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ error: text }, { status: res.status });
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Local dev path: connect to Temporal directly
  const { Connection, Client } = await import('@temporalio/client');
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  let connection = null;
  try {
    connection = await Connection.connect({ address });
    const client = new Client({ connection });
    const handle = client.workflow.getHandle(workflow_id);
    await handle.signal(signalName, signalPayload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await connection?.close();
  }
}
