import { create } from 'zustand';
import { gantryClient, type GantryTask } from '@/modules/kernel';
import { subscribeTaskEvents } from '@/modules/kernel/sse';
import { deliverableFromTaskResult, type Deliverable } from '@/modules/artifacts';
import type { HitlCheckpoint } from '@/modules/hitl';
import { buildFloorSeats, inferActiveRole } from '@/modules/operators/presence';
import type { OperatorSeat } from '@/modules/operators';
import { eventFromSse, firmEvent, userEvent } from './model';
import type { EngagementEvent } from './types';
import { steerJob } from './api';

type EngagementState = {
  taskId: string | null;
  task: GantryTask | null;
  events: EngagementEvent[];
  seats: OperatorSeat[];
  hitl: HitlCheckpoint | null;
  deliverable: Deliverable | null;
  foremanSnippet: string;
  streaming: boolean;
  error: string | null;
  open: (taskId: string) => Promise<void>;
  reset: () => void;
  sendSteer: (prompt: string) => Promise<void>;
  clearHitl: () => void;
};

let abort: AbortController | null = null;

const emptySeats = () =>
  buildFloorSeats({
    snippet: 'ready',
  });

export const useEngagementStore = create<EngagementState>((set, get) => ({
  taskId: null,
  task: null,
  events: [],
  seats: emptySeats(),
  hitl: null,
  deliverable: null,
  foremanSnippet: 'ready',
  streaming: false,
  error: null,

  reset: () => {
    abort?.abort();
    abort = null;
    set({
      taskId: null,
      task: null,
      events: [],
      seats: emptySeats(),
      hitl: null,
      deliverable: null,
      foremanSnippet: 'ready',
      streaming: false,
      error: null,
    });
  },

  clearHitl: () => set({ hitl: null }),

  open: async (taskId: string) => {
    abort?.abort();
    abort = new AbortController();
    const signal = abort.signal;

    set({
      taskId,
      events: [],
      hitl: null,
      deliverable: null,
      streaming: true,
      error: null,
      foremanSnippet: 'opening…',
      seats: buildFloorSeats({ snippet: 'opening…' }),
    });

    try {
      const [task, catalog] = await Promise.all([
        gantryClient.getTask(taskId),
        gantryClient.listAgents().catch(() => null),
      ]);

      if (signal.aborted) return;

      const catalogRoles =
        catalog?.agents.map(a => ({
          roleId: (a.role || a.name).toLowerCase(),
          title: a.name,
          description: a.description,
        })) ?? [];

      const pending = task.pending_hitl?.[0];
      const hitl: HitlCheckpoint | null = pending
        ? {
            taskId,
            checkpoint: pending.checkpoint,
            workflowId: pending.workflow_id,
            description: pending.description,
            questions: pending.questions,
          }
        : null;

      const deliverable = deliverableFromTaskResult(task);
      const seed: EngagementEvent[] = [
        firmEvent(`Matter ${taskId.slice(0, 8)} · ${task.status}`),
      ];
      if (hitl) {
        seed.push({
          id: `hitl-seed-${taskId}`,
          kind: 'hitl',
          at: new Date().toISOString(),
          body: hitl.description || 'Approval required',
          hitlCheckpoint: hitl.checkpoint,
          hitlWorkflowId: hitl.workflowId,
        });
      }
      if (deliverable) {
        seed.push({
          id: `art-seed-${taskId}`,
          kind: 'artifact',
          at: new Date().toISOString(),
          body: deliverable.title,
          artifactRef: taskId,
          meta: task.result ?? undefined,
        });
      }

      set({
        task,
        events: seed,
        hitl,
        deliverable,
        foremanSnippet: hitl ? 'waiting on you' : task.status,
        seats: buildFloorSeats({
          catalogRoles,
          blocked: Boolean(hitl),
          activeRoleId: hitl ? 'foreman' : task.status === 'running' ? 'builder' : 'foreman',
          snippet: hitl ? 'waiting on you' : task.status,
          doneRoleIds: task.status === 'completed' ? catalogRoles.map(r => r.roleId) : [],
        }),
      });

      // Hydrate messages
      try {
        const msgs = await gantryClient.getTaskMessages(taskId);
        if (!signal.aborted && Array.isArray(msgs.messages)) {
          const mapped: EngagementEvent[] = msgs.messages.map((m, i) => {
            const rec = m as Record<string, unknown>;
            const role =
              typeof rec.role === 'string'
                ? rec.role
                : typeof rec.agent === 'string'
                  ? rec.agent
                  : null;
            const content =
              typeof rec.content === 'string'
                ? rec.content
                : typeof rec.text === 'string'
                  ? rec.text
                  : JSON.stringify(rec);
            const isUser = role === 'user' || role === 'human';
            return {
              id: `hist-${i}-${taskId}`,
              kind: isUser ? 'user' : role ? 'operator' : 'firm',
              at: typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
              body: content,
              operatorRoleId: !isUser && role ? String(role).toLowerCase() : undefined,
            };
          });
          if (mapped.length) {
            set(s => ({ events: [...mapped, ...s.events.filter(e => e.kind === 'hitl' || e.kind === 'artifact')] }));
          }
        }
      } catch {
        /* messages optional */
      }

      for await (const raw of subscribeTaskEvents(taskId, { signal })) {
        if (signal.aborted) return;
        const ev = eventFromSse(raw, taskId);
        if (ev) {
          set(s => ({ events: [...s.events, ev] }));
        }

        if (raw.type === 'hitl') {
          set({
            hitl: {
              taskId,
              checkpoint: raw.checkpoint,
              workflowId: raw.workflow_id,
              description: raw.description,
            },
            foremanSnippet: 'waiting on you',
            seats: buildFloorSeats({
              catalogRoles,
              blocked: true,
              activeRoleId: 'foreman',
              snippet: 'waiting on you',
            }),
          });
        }

        if (raw.type === 'lifecycle' || raw.type === 'status') {
          const text = raw.type === 'lifecycle' ? raw.event : raw.status;
          const active = inferActiveRole(text) ?? get().seats.find(x => x.presence === 'active')?.roleId;
          set({
            foremanSnippet: text,
            seats: buildFloorSeats({
              catalogRoles,
              activeRoleId: active,
              blocked: Boolean(get().hitl),
              snippet: text,
            }),
          });
        }

        if (raw.type === 'done') {
          const refreshed = await gantryClient.getTask(taskId).catch(() => null);
          const del = refreshed
            ? deliverableFromTaskResult(refreshed)
            : raw.result
              ? deliverableFromTaskResult({
                  task_id: taskId,
                  status: raw.status ?? 'completed',
                  result: {
                    pr_url: raw.result.pr_url as string | undefined,
                    branch: raw.result.branch as string | undefined,
                  },
                })
              : null;
          set({
            streaming: false,
            task: refreshed ?? get().task,
            deliverable: del,
            foremanSnippet: 'delivered',
            hitl: null,
            seats: buildFloorSeats({
              catalogRoles,
              doneRoleIds: catalogRoles.map(r => r.roleId),
              snippet: 'delivered',
            }),
          });
          return;
        }

        if (raw.type === 'error') {
          set({ streaming: false, error: raw.message, foremanSnippet: 'attention' });
          return;
        }
      }

      if (!signal.aborted) set({ streaming: false });
    } catch (e) {
      if (signal.aborted) return;
      set({ streaming: false, error: (e as Error).message, foremanSnippet: 'error' });
    }
  },

  sendSteer: async (prompt: string) => {
    const taskId = get().taskId;
    if (!taskId || !prompt.trim()) return;
    set(s => ({ events: [...s.events, userEvent(prompt.trim())] }));
    await steerJob({ type: 'followup', taskId, prompt: prompt.trim() });
  },
}));
