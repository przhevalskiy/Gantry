import { create } from 'zustand';
import { Template, TemplateCreate, TemplateUpdate } from '@/shared/types';
import { api } from '@/shared/services/api';

interface TemplateState {
  templates: Template[];
  isLoading: boolean;
  error: string | null;
}

interface TemplateActions {
  fetchTemplates: () => Promise<void>;
  createTemplate: (data: TemplateCreate) => Promise<Template>;
  updateTemplate: (id: string, data: TemplateUpdate) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

type TemplateStore = TemplateState & TemplateActions;

export const useTemplateStore = create<TemplateStore>((set) => ({
  templates: [],
  isLoading: false,
  error: null,

  fetchTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      const templates = await api.getTemplates();
      set({ templates, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createTemplate: async (data: TemplateCreate) => {
    set({ isLoading: true, error: null });
    try {
      const template = await api.createTemplate(data);
      set(state => ({ templates: [template, ...state.templates], isLoading: false }));
      return template;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updateTemplate: async (id: string, data: TemplateUpdate) => {
    try {
      const updated = await api.updateTemplate(id, data);
      set(state => ({
        templates: state.templates.map(t => (t.id === id ? updated : t)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteTemplate: async (id: string) => {
    try {
      await api.deleteTemplate(id);
      set(state => ({ templates: state.templates.filter(t => t.id !== id) }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ templates: [], isLoading: false, error: null }),
}));
