import { create } from 'zustand';
import { Discussion, DiscussionCreate } from '@/shared/types';
import { api } from '@/shared/services/api';

interface DiscussionState {
  discussions: Discussion[];
  activeDiscussionId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface DiscussionActions {
  fetchDiscussions: () => Promise<void>;
  createDiscussion: (data?: DiscussionCreate) => Promise<Discussion>;
  deleteDiscussion: (id: string) => Promise<void>;
  deleteAllDiscussions: () => Promise<void>;
  setActiveDiscussionId: (id: string | null) => void;
  activateDiscussion: (id: string) => Promise<void>;
  updateDiscussionTitle: (id: string, title: string) => Promise<void>;
  moveDiscussionToProject: (id: string, projectId: string | null) => Promise<void>;
  getActiveDiscussion: () => Discussion | undefined;
  clearError: () => void;
  reset: () => void;
}

type DiscussionStore = DiscussionState & DiscussionActions;

export const useDiscussionStore = create<DiscussionStore>((set, get) => ({
  discussions: [],
  activeDiscussionId: null,
  isLoading: false,
  error: null,

  fetchDiscussions: async () => {
    set({ isLoading: true, error: null });
    try {
      const discussions = await api.getDiscussions();
      set({ discussions, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createDiscussion: async (data?: DiscussionCreate) => {
    set({ isLoading: true, error: null });
    try {
      const discussion = await api.createDiscussion(data);
      set(state => ({
        discussions: [discussion, ...state.discussions],
        isLoading: false,
      }));
      return discussion;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  deleteDiscussion: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteDiscussion(id);
      set(state => {
        const newDiscussions = state.discussions.filter(d => d.id !== id);
        const newActiveId = state.activeDiscussionId === id
          ? (newDiscussions[0]?.id || null)
          : state.activeDiscussionId;
        return { discussions: newDiscussions, activeDiscussionId: newActiveId, isLoading: false };
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  deleteAllDiscussions: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteAllDiscussions();
      set({ discussions: [], activeDiscussionId: null, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  setActiveDiscussionId: (id: string | null) => set({ activeDiscussionId: id }),

  activateDiscussion: async (id: string) => {
    try {
      await api.activateDiscussion(id);
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateDiscussionTitle: async (id: string, title: string) => {
    try {
      const updated = await api.updateDiscussion(id, { title });
      set(state => ({
        discussions: state.discussions.map(d =>
          d.id === id ? { ...d, title: updated.title } : d
        ),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  moveDiscussionToProject: async (id: string, projectId: string | null) => {
    try {
      await api.updateDiscussion(id, { project_id: projectId });
      set(state => ({
        discussions: state.discussions.map(d =>
          d.id === id ? { ...d, project_id: projectId } : d
        ),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  getActiveDiscussion: () => {
    const state = get();
    return state.discussions.find(d => d.id === state.activeDiscussionId);
  },

  clearError: () => set({ error: null }),

  reset: () => set({ discussions: [], activeDiscussionId: null, isLoading: false, error: null }),
}));
