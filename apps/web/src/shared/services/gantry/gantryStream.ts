/**
 * Maps Gantry GET /v1/tasks/{id}/events SSE → Qodex SSEEvent shapes
 * so useSSE / chat UI keep the same streaming UX.
 */
import type { SSEEvent } from '@/shared/types';
import { gantryBaseUrl } from './config';
import { getApiKey } from './apiKeyStore';

type GantryEvent = Record<string, unknown>;

function mapEvent(raw: GantryEvent): SSEEvent | null {
  const type = String(raw.type ?? '');
  switch (type) {
    case 'status':
      return {
        type: 'chunk',
        content: `[status: ${raw.status}]\n`,
        provider: 'gantry',
      } as SSEEvent;
    case 'lifecycle':
      return {
        type: 'chunk',
        content: `▸ ${raw.event}\n`,
        provider: 'gantry',
      } as SSEEvent;
    case 'message': {
      const msg = raw.message as { content?: string } | undefined;
      const text =
        typeof msg?.content === 'string'
          ? msg.content
          : JSON.stringify(msg ?? {});
      return { type: 'chunk', content: `${text}\n`, provider: 'gantry' } as SSEEvent;
    }
    case 'hitl':
      return {
        type: 'checklist',
        fields: {
          checkpoint: String(raw.checkpoint ?? ''),
          workflow_id: String(raw.workflow_id ?? ''),
          description: String(raw.description ?? 'Approval required'),
        },
        intent: 'factory_hitl',
      } as SSEEvent;
    case 'error':
      return { type: 'error', error: String(raw.message ?? 'stream error') } as SSEEvent;
    case 'done': {
      const result = raw.result as { pr_url?: string } | null | undefined;
      if (result?.pr_url) {
        return {
          type: 'chunk',
          content: `\n✓ PR ready: ${result.pr_url}\n`,
          provider: 'gantry',
        } as SSEEvent;
      }
      return { type: 'done', provider: 'gantry' } as SSEEvent;
    }
    default:
      return null;
  }
}

export async function* streamGantryTask(taskId: string): AsyncGenerator<SSEEvent, void, unknown> {
  const key = getApiKey();
  const base = gantryBaseUrl();
  const response = await fetch(`${base}/v1/tasks/${encodeURIComponent(taskId)}/events`, {
    headers: {
      Accept: 'text/event-stream',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Stream failed' }));
    yield { type: 'error', error: (error as { detail?: string }).detail ?? `HTTP ${response.status}` } as SSEEvent;
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'No response body' } as SSEEvent;
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const line = frame.split('\n').find(l => l.startsWith('data: '));
      if (!line) continue;
      try {
        const raw = JSON.parse(line.slice(6)) as GantryEvent;
        const mapped = mapEvent(raw);
        if (!mapped) continue;
        yield mapped;
        if (mapped.type === 'done' || mapped.type === 'error') return;
        if (raw.type === 'done') {
          yield { type: 'done', provider: 'gantry' } as SSEEvent;
          return;
        }
      } catch {
        /* skip malformed frame */
      }
    }
  }

  yield { type: 'done', provider: 'gantry' } as SSEEvent;
}
