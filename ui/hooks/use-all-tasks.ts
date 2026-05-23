'use client';

import { useQuery } from '@tanstack/react-query';
import { useAgentex } from '@/components/providers';
import type { TaskListResponse } from 'agentex/resources/tasks';

export type LiveTask = TaskListResponse[number] & {
  goal?: string;
  project_id?: string;
};

const RUNNING_POLL = 5_000;
const IDLE_POLL    = 30_000;

export function useAllTasks() {
  const { agentexClient } = useAgentex();

  return useQuery<LiveTask[]>({
    queryKey: ['all-tasks'],
    queryFn: async () => {
      const tasks = await agentexClient.tasks.list();
      return (tasks ?? []).map(t => ({
        ...t,
        goal:       (t.params as Record<string, unknown>)?.query as string | undefined
                 ?? (t.params as Record<string, unknown>)?.prompt as string | undefined,
        project_id: (t.params as Record<string, unknown>)?.project_id as string | undefined,
      }));
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasRunning = data?.some(t => t.status === 'RUNNING');
      return hasRunning ? RUNNING_POLL : IDLE_POLL;
    },
  });
}
