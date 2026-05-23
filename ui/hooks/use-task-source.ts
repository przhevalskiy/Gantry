import { useQuery } from '@tanstack/react-query';

export interface TaskSource {
  source: 'ui' | 'api' | 'github_issues';
  github_owner?: string;
  github_repo?: string;
  github_issue_number?: number;
}

export function useTaskSource(taskId: string): TaskSource | null {
  const base = process.env.NEXT_PUBLIC_GANTRY_URL ?? 'http://localhost:8001';
  const { data } = useQuery<TaskSource>({
    queryKey: ['task-source', taskId],
    queryFn: () => fetch(`${base}/v1/tasks/${taskId}/source`).then(r => r.ok ? r.json() : null),
    enabled: !!taskId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  return data ?? null;
}
