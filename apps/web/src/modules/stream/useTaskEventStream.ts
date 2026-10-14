import { useCallback, useEffect, useState } from "react";
import { getTask, streamTaskEvents } from "../../services/gantry/client";
import {
  GantryApiError,
  type PendingHitl,
  type Task,
  type TaskResult,
  type TaskSseEvent,
} from "../../services/gantry/types";

export type StreamRow = {
  id: string;
  at: number;
  event: TaskSseEvent;
};

function rowId(event: TaskSseEvent, seq: number): string {
  if (event.type === "message") {
    const mid = event.message?.id;
    if (typeof mid === "string" && mid) return `msg:${mid}`;
  }
  if (event.type === "hitl") {
    return `hitl:${event.checkpoint}:${event.workflow_id}`;
  }
  if (event.type === "lifecycle") {
    return `life:${event.event}:${seq}`;
  }
  return `${event.type}:${seq}`;
}

function upsertPending(list: PendingHitl[], next: PendingHitl): PendingHitl[] {
  const key = next.workflow_id || `${next.checkpoint}`;
  const without = list.filter(
    (p) => (p.workflow_id || `${p.checkpoint}`) !== key,
  );
  return [...without, next];
}

/**
 * Live engagement stream for one task. Re-GETs task on mount (reconnect rule);
 * SSE drives timeline + status + pending HITL until terminal.
 */
export function useTaskEventStream(taskId: string | undefined) {
  const [task, setTask] = useState<Task | null>(null);
  const [rows, setRows] = useState<StreamRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<TaskResult | null | undefined>(undefined);
  const [pendingHitl, setPendingHitl] = useState<PendingHitl[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  const dismissHitl = useCallback((workflowId: string) => {
    setPendingHitl((prev) => prev.filter((p) => p.workflow_id !== workflowId));
  }, []);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    const ac = new AbortController();
    let seq = 0;

    setLoading(true);
    setStreamError(null);
    setRows([]);
    setStatus(null);
    setResult(undefined);
    setPendingHitl([]);
    setLive(false);

    void (async () => {
      try {
        const t = await getTask(taskId);
        if (cancelled) return;
        setTask(t);
        setStatus(t.status);
        if (t.result) setResult(t.result);
        setPendingHitl(t.pending_hitl ?? []);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof GantryApiError
            ? e.detail
            : e instanceof Error
              ? e.message
              : "Failed to load run";
        setStreamError(msg);
        setLoading(false);
        return;
      } finally {
        if (!cancelled) setLoading(false);
      }

      setLive(true);
      try {
        for await (const event of streamTaskEvents(taskId, { signal: ac.signal })) {
          if (cancelled) break;
          seq += 1;
          const id = rowId(event, seq);
          setRows((prev) => {
            if (prev.some((r) => r.id === id && event.type !== "status")) {
              return prev;
            }
            return [...prev, { id, at: Date.now(), event }];
          });

          if (event.type === "status") {
            setStatus(event.status);
            setTask((prev) => (prev ? { ...prev, status: event.status } : prev));
          } else if (event.type === "hitl") {
            setPendingHitl((prev) =>
              upsertPending(prev, {
                checkpoint: event.checkpoint,
                workflow_id: event.workflow_id,
                description: event.description,
              }),
            );
          } else if (event.type === "done") {
            setStatus(event.status);
            if (event.result !== undefined) setResult(event.result ?? null);
            setPendingHitl([]);
            setTask((prev) =>
              prev
                ? {
                    ...prev,
                    status: event.status,
                    result: event.result ?? prev.result,
                    pending_hitl: [],
                  }
                : prev,
            );
          } else if (event.type === "error") {
            setStreamError(event.message);
          }
        }
      } catch (e) {
        if (cancelled || ac.signal.aborted) return;
        const msg =
          e instanceof GantryApiError
            ? e.detail
            : e instanceof Error
              ? e.message
              : "Stream failed";
        setStreamError(msg);
      } finally {
        if (!cancelled) setLive(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [taskId]);

  return {
    task,
    rows,
    status,
    result,
    pendingHitl,
    dismissHitl,
    streamError,
    loading,
    live,
  };
}
