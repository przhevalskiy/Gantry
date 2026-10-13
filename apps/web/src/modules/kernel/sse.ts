/**
 * Raw Gantry task SSE — no legacy chat mapping.
 * See docs/platform/sse-events.md
 */
import { gantryBaseUrl } from '@/shared/services/gantry/config';
import { getApiKey } from '@/shared/services/gantry/apiKeyStore';

export type TaskSseEvent =
  | { type: 'status'; status: string }
  | { type: 'lifecycle'; event: string }
  | { type: 'message'; message: Record<string, unknown> }
  | { type: 'hitl'; checkpoint: string; workflow_id: string; description?: string }
  | { type: 'error'; message: string }
  | { type: 'done'; status?: string; result?: Record<string, unknown> | null };

export async function* subscribeTaskEvents(
  taskId: string,
  options?: { signal?: AbortSignal },
): AsyncGenerator<TaskSseEvent, void, unknown> {
  const signal = options?.signal;
  const key = getApiKey();
  const base = gantryBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${base}/v1/tasks/${encodeURIComponent(taskId)}/events`, {
      headers: {
        Accept: 'text/event-stream',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    yield { type: 'error', message: (error as Error).message };
    return;
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Stream failed' }));
    yield {
      type: 'error',
      message: (err as { detail?: string }).detail ?? `HTTP ${response.status}`,
    };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', message: 'No response body' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => {});
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const line = frame.split('\n').find(l => l.startsWith('data: '));
      if (!line) continue;
      try {
        const raw = JSON.parse(line.slice(6)) as Record<string, unknown>;
        const mapped = mapRaw(raw);
        if (!mapped) continue;
        yield mapped;
        if (mapped.type === 'done' || mapped.type === 'error') return;
      } catch {
        /* skip malformed */
      }
    }
  }
}

function mapRaw(raw: Record<string, unknown>): TaskSseEvent | null {
  const type = String(raw.type ?? '');
  switch (type) {
    case 'status':
      return { type: 'status', status: String(raw.status ?? '') };
    case 'lifecycle':
      return { type: 'lifecycle', event: String(raw.event ?? '') };
    case 'message': {
      const message = raw.message;
      if (message && typeof message === 'object') {
        return { type: 'message', message: message as Record<string, unknown> };
      }
      return null;
    }
    case 'hitl':
      return {
        type: 'hitl',
        checkpoint: String(raw.checkpoint ?? ''),
        workflow_id: String(raw.workflow_id ?? ''),
        description: raw.description ? String(raw.description) : undefined,
      };
    case 'error':
      return { type: 'error', message: String(raw.message ?? 'stream error') };
    case 'done':
      return {
        type: 'done',
        status: raw.status ? String(raw.status) : undefined,
        result: (raw.result as Record<string, unknown> | null | undefined) ?? null,
      };
    default:
      return null;
  }
}
