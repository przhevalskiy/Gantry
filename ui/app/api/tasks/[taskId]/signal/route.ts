import { NextRequest, NextResponse } from 'next/server';
import { Connection, Client } from '@temporalio/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { workflow_id, approved } = await req.json();

  if (!workflow_id || typeof approved !== 'boolean') {
    return NextResponse.json(
      { error: 'workflow_id (string) and approved (boolean) are required' },
      { status: 400 }
    );
  }

  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';

  let connection: Connection | null = null;
  try {
    connection = await Connection.connect({ address });
    const client = new Client({ connection });
    const handle = client.workflow.getHandle(workflow_id);
    await handle.signal('approve', approved);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await connection?.close();
  }
}
