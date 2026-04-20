'use client';

import { useMutation } from '@tanstack/react-query';
import { agentRPCNonStreaming } from 'agentex/lib';
import { useAgentex } from '@/components/providers';

export function useSendFollowUp(taskId: string) {
  const { agentexClient } = useAgentex();

  return useMutation({
    mutationFn: async (prompt: string) => {
      const response = await agentRPCNonStreaming(
        agentexClient,
        { agentName: 'swarm-factory' },
        'event/send',
        {
          task_id: taskId,
          content: {
            type: 'text' as const,
            content: prompt,
            author: 'user',
          },
        }
      );

      if (response.error != null) {
        throw new Error(response.error.message);
      }

      return response.result;
    },
  });
}
