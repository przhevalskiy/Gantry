import type { TaskSseEvent } from '@/modules/kernel/sse';
import type { EngagementEvent } from './types';

let seq = 0;
function nid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

export function eventFromSse(ev: TaskSseEvent, taskId: string): EngagementEvent | null {
  const at = new Date().toISOString();
  switch (ev.type) {
    case 'status':
      return {
        id: nid('status'),
        kind: 'lifecycle',
        at,
        body: `Status · ${ev.status}`,
      };
    case 'lifecycle':
      return {
        id: nid('life'),
        kind: 'lifecycle',
        at,
        body: ev.event,
      };
    case 'message': {
      const content = extractMessageBody(ev.message);
      const role = extractOperatorRole(ev.message);
      return {
        id: nid('msg'),
        kind: role ? 'operator' : 'firm',
        at,
        body: content,
        operatorRoleId: role ?? undefined,
      };
    }
    case 'hitl':
      return {
        id: nid('hitl'),
        kind: 'hitl',
        at,
        body: ev.description || 'Approval required',
        hitlCheckpoint: ev.checkpoint,
        hitlWorkflowId: ev.workflow_id,
      };
    case 'error':
      return {
        id: nid('err'),
        kind: 'system',
        at,
        body: ev.message,
      };
    case 'done': {
      const result = ev.result;
      const hasArtifact = Boolean(result && (result.pr_url || result.branch));
      if (hasArtifact) {
        return {
          id: nid('art'),
          kind: 'artifact',
          at,
          body: result?.pr_url
            ? `Pull request ready`
            : `Branch ready · ${String(result?.branch ?? '')}`,
          artifactRef: taskId,
          meta: result ?? undefined,
        };
      }
      return {
        id: nid('done'),
        kind: 'lifecycle',
        at,
        body: `Engagement closed · ${ev.status ?? 'done'}`,
        meta: result ?? undefined,
      };
    }
    default:
      return null;
  }
}

export function userEvent(body: string): EngagementEvent {
  return {
    id: nid('user'),
    kind: 'user',
    at: new Date().toISOString(),
    body,
  };
}

export function firmEvent(body: string): EngagementEvent {
  return {
    id: nid('firm'),
    kind: 'firm',
    at: new Date().toISOString(),
    body,
  };
}

function extractMessageBody(message: Record<string, unknown>): string {
  if (typeof message.content === 'string') return message.content;
  if (typeof message.text === 'string') return message.text;
  if (typeof message.body === 'string') return message.body;
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

function extractOperatorRole(message: Record<string, unknown>): string | null {
  const candidates = [message.agent, message.role, message.speaker, message.name];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim().toLowerCase();
  }
  return null;
}
