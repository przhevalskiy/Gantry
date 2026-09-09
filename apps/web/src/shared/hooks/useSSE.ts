import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sseClient } from '@/shared/services/sse';
import { useChatStore } from '@/features/chat';
import { useDiscussionStore } from '@/features/discussions';
import { approveFactoryHitl } from '@/shared/services/gantry/hitl';

export function useSSE() {
  const navigate = useNavigate();
  const messageIdRef = useRef<string>('');

  const {
    addMessage,
    startStream,
    appendToStream,
    setStreamIntent,
    finalizeStream,
    cancelStream,
    addChecklistMessage,
    setSubmitted,
    setActiveTaskId,
  } = useChatStore();
  const { activeDiscussionId, updateDiscussionTitle } = useDiscussionStore();

  const sendMessage = useCallback(
    async (content: string, discussionId?: string) => {
      let targetDiscussionId = discussionId || activeDiscussionId;

      if (!targetDiscussionId) {
        const { createDiscussion } = useDiscussionStore.getState();
        const newDiscussion = await createDiscussion();
        targetDiscussionId = newDiscussion.id;
        useChatStore.getState().skipNextMessageLoad();
        navigate(`/chat/${targetDiscussionId}`, { replace: true });
      }

      const userMessage = {
        id: crypto.randomUUID(),
        content,
        role: 'user' as const,
        timestamp: new Date().toISOString(),
      };
      addMessage(userMessage);

      startStream();
      messageIdRef.current = crypto.randomUUID();

      try {
        const stream = sseClient.streamChat({
          discussion_id: targetDiscussionId,
          message: content,
        });

        for await (const event of stream) {
          if (event.type === 'discussion_title') {
            updateDiscussionTitle(event.discussion_id, event.title);
          } else if (event.type === 'intent') {
            setStreamIntent(event.intent, event.label);
          } else if (event.type === 'chunk') {
            appendToStream(event.content);
          } else if (event.type === 'error') {
            appendToStream(event.error);
            finalizeStream(messageIdRef.current);
            return;
          } else if (event.type === 'checklist') {
            addChecklistMessage(event.fields, event.intent, targetDiscussionId);
          } else if (event.type === 'submitted') {
            setSubmitted(true);
            setActiveTaskId(event.hive_task_id);
          } else if (event.type === 'done') {
            finalizeStream(messageIdRef.current);
            break;
          }
        }
      } catch (error) {
        cancelStream();
        throw error;
      }
    },
    [
      navigate,
      activeDiscussionId,
      addMessage,
      startStream,
      appendToStream,
      setStreamIntent,
      finalizeStream,
      cancelStream,
      addChecklistMessage,
      setSubmitted,
      setActiveTaskId,
      updateDiscussionTitle,
    ],
  );

  const resolveHitl = useCallback(
    async (fields: Record<string, string>, approved: boolean, discussionId?: string) => {
      const targetDiscussionId = discussionId || activeDiscussionId;
      if (!targetDiscussionId) return;

      const label = approved ? 'Approved checkpoint' : 'Rejected checkpoint';
      addMessage({
        id: crypto.randomUUID(),
        content: label,
        role: 'user',
        timestamp: new Date().toISOString(),
      });

      try {
        await approveFactoryHitl(targetDiscussionId, fields, approved);
        appendToStream(`\n✓ HITL ${approved ? 'approved' : 'rejected'} — workflow continuing…\n`);
      } catch (error) {
        appendToStream(`\n✗ HITL failed: ${(error as Error).message}\n`);
      }
    },
    [activeDiscussionId, addMessage, appendToStream],
  );

  const stopStream = useCallback(() => {
    sseClient.cancel();
    const discussionId = useDiscussionStore.getState().activeDiscussionId;
    if (discussionId) {
      useChatStore.getState().gracefulStop(messageIdRef.current, discussionId);
    }
  }, []);

  return {
    sendMessage,
    resolveHitl,
    stopStream,
    isStreaming: useChatStore((state) => state.isStreaming),
    activeTaskId: useChatStore((state) => state.activeTaskId),
  };
}
