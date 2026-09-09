import { useCallback, useEffect, useRef, useState } from 'react';
import { gantryClient, type GantryTaskSummary } from '@/shared/services/gantry/client';
import { GANTRY_DEV_AUTH_BYPASS } from '@/shared/services/gantry/config';
import { hasApiKey } from '@/shared/services/gantry/apiKeyStore';
import { useAuthStore } from '@/features/auth';

const RUNNING_POLL_MS = 5_000;
const IDLE_POLL_MS = 30_000;
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'terminated', 'timeout', 'canceled']);

function isRunningStatus(status: string): boolean {
  return !TERMINAL.has(status.toLowerCase());
}

export function useTaskList(enabled = true) {
  const user = useAuthStore(s => s.user);
  const canFetch = enabled && (!!user || GANTRY_DEV_AUTH_BYPASS || hasApiKey());
  const [tasks, setTasks] = useState<GantryTaskSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const load = useCallback(async (): Promise<GantryTaskSummary[]> => {
    if (!canFetch) return [];
    setIsLoading(prev => (tasksRef.current.length === 0 ? true : prev));
    try {
      const resp = await gantryClient.listTasks();
      setTasks(resp.tasks);
      setError(null);
      return resp.tasks;
    } catch (e) {
      setError((e as Error).message);
      return tasksRef.current;
    } finally {
      setIsLoading(false);
    }
  }, [canFetch]);

  useEffect(() => {
    if (!canFetch) {
      setTasks([]);
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      const rows = await load();
      if (cancelled) return;
      const hasRunning = rows.some(t => isRunningStatus(t.status));
      timer = window.setTimeout(tick, hasRunning ? RUNNING_POLL_MS : IDLE_POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [canFetch, load]);

  return { tasks, isLoading, error, refresh: load };
}
