import { create } from 'zustand';
import { Message, MessageRole } from '@/shared/types';
import { api } from '@/shared/services/api';

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  currentStreamContent: string;
  currentStreamIntent: { intent: string; label: string } | null;
  persistedIntent: { intent: string; label: string } | null;
  isSubmitted: boolean;
  activeTaskId: string | null;
  error: string | null;
  isLoadingMessages: boolean;
  _skipNextMessageLoad: boolean;
  hoverPlaceholder: string;
}

interface ChatActions {
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  loadMessagesForDiscussion: (discussionId: string | null) => Promise<void>;
  skipNextMessageLoad: () => void;
  startStream: () => void;
  appendToStream: (chunk: string) => void;
  setStreamIntent: (intent: string, label: string) => void;
  finalizeStream: (messageId: string) => void;
  gracefulStop: (messageId: string, discussionId: string) => void;
  cancelStream: () => void;
  addChecklistMessage: (fields: Record<string, string>, intent: string, discussionId: string) => void;
  setSubmitted: (submitted: boolean) => void;
  setActiveTaskId: (taskId: string | null) => void;
  clearMessages: () => void;
  clearError: () => void;
  setHoverPlaceholder: (text: string) => void;
}

function gracefulTruncate(content: string): string {
  if (!content || content.trim().length < 10) return content;

  let text = content;

  const fenceCount = (text.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) {
    text = text.trimEnd() + '\n```';
  }

  const boundaryPattern = /[.!?:;]\s|\n\n|\n(?=[-*+]\s|\d+\.\s|#{1,4}\s|```)/g;
  let lastBoundary = -1;
  let match;
  while ((match = boundaryPattern.exec(text)) !== null) {
    lastBoundary = match.index + 1;
  }

  if (lastBoundary > 0 && lastBoundary > text.length * 0.4) {
    text = text.slice(0, lastBoundary).trimEnd();
  }

  const finalFenceCount = (text.match(/^```/gm) || []).length;
  if (finalFenceCount % 2 !== 0) {
    text = text.trimEnd() + '\n```';
  }

  return text;
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentStreamContent: '',
  currentStreamIntent: null,
  persistedIntent: null,
  isSubmitted: false,
  activeTaskId: null,
  error: null,
  isLoadingMessages: false,
  _skipNextMessageLoad: false,
  hoverPlaceholder: '',

  setMessages: (messages: Message[]) => set({ messages }),

  loadMessagesForDiscussion: async (discussionId: string | null) => {
    if (!discussionId) {
      set({ messages: [], isLoadingMessages: false });
      return;
    }

    if (get()._skipNextMessageLoad) {
      set({ _skipNextMessageLoad: false });
      return;
    }

    set({ isLoadingMessages: true, error: null });
    try {
      const discussion = await api.getDiscussion(discussionId);
      set({ messages: discussion.messages, isLoadingMessages: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoadingMessages: false });
    }
  },

  skipNextMessageLoad: () => set({ _skipNextMessageLoad: true }),

  addMessage: (message: Message) => {
    set(state => ({ messages: [...state.messages, message] }));
  },

  startStream: () => {
    set({
      isStreaming: true,
      currentStreamContent: '',
      currentStreamIntent: null,
      isSubmitted: false,
      error: null,
    });
  },

  appendToStream: (chunk: string) => {
    set(state => ({ currentStreamContent: state.currentStreamContent + chunk }));
  },

  setStreamIntent: (intent: string, label: string) => {
    set({ currentStreamIntent: { intent, label }, persistedIntent: { intent, label } });
  },

  finalizeStream: (messageId: string) => {
    const state = get();

    // If a checklist message already cleared the stream content,
    // don't add a duplicate empty/preamble message — just stop streaming.
    if (!state.currentStreamContent.trim()) {
      set({
        isStreaming: false,
        currentStreamContent: '',
        currentStreamIntent: null,
      });
      return;
    }

    const assistantMessage: Message = {
      id: messageId,
      content: state.currentStreamContent,
      role: 'assistant' as MessageRole,
      timestamp: new Date().toISOString(),
      intent: (state.currentStreamIntent ?? state.persistedIntent)?.intent || undefined,
    };

    set(state => ({
      messages: [...state.messages, assistantMessage],
      isStreaming: false,
      currentStreamContent: '',
      currentStreamIntent: null,
    }));
  },

  gracefulStop: (messageId: string, discussionId: string) => {
    const state = get();
    const cleaned = gracefulTruncate(state.currentStreamContent);

    if (!cleaned.trim()) {
      set({
        isStreaming: false,
        currentStreamContent: '',
        currentStreamIntent: null,
      });
      return;
    }

    const assistantMessage: Message = {
      id: messageId,
      content: cleaned,
      role: 'assistant' as MessageRole,
      timestamp: new Date().toISOString(),
      intent: state.currentStreamIntent?.intent || undefined,
    };

    set(state => ({
      messages: [...state.messages, assistantMessage],
      isStreaming: false,
      currentStreamContent: '',
      currentStreamIntent: null,
    }));

    api.addMessage(discussionId, cleaned, 'assistant' as MessageRole).catch(() => {});
  },

  cancelStream: () => {
    set({
      isStreaming: false,
      currentStreamContent: '',
      currentStreamIntent: null,
    });
  },

  addChecklistMessage: (fields: Record<string, string>, intent: string, discussionId: string) => {
    const lines = Object.entries(fields)
      .map(([k, v]) => `**${k}**: ${v}`)
      .join('\n');
    const content = `__checklist__\n${lines}`;

    const checklistMessage: Message = {
      id: `checklist-${Date.now()}`,
      content,
      role: 'assistant' as MessageRole,
      timestamp: new Date().toISOString(),
      intent,
    };

    // Clear any streamed preamble text so finalizeStream produces nothing
    set(state => ({
      messages: [...state.messages, checklistMessage],
      currentStreamContent: '',
    }));

    // Persist to DB so Claude sees the checklist in context on the next turn
    api.addMessage(discussionId, content, 'assistant' as MessageRole).catch(() => {});
  },

  setSubmitted: (submitted: boolean) => set({ isSubmitted: submitted }),

  setActiveTaskId: (taskId: string | null) => set({ activeTaskId: taskId }),

  clearMessages: () => set({ messages: [], error: null, persistedIntent: null, activeTaskId: null }),

  clearError: () => set({ error: null }),

  setHoverPlaceholder: (text: string) => set({ hoverPlaceholder: text }),
}));
