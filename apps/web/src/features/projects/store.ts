import { create } from 'zustand';
import { Project, ProjectCreate, ProjectUpdate, Discussion } from '@/shared/types';
import { api } from '@/shared/services/api';

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
}

interface ProjectActions {
  fetchProjects: () => Promise<void>;
  createProject: (data: ProjectCreate) => Promise<Project>;
  updateProject: (id: string, data: ProjectUpdate) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProjectDiscussions: (id: string) => Promise<Discussion[]>;
  getProjectById: (id: string) => Project | undefined;
  clearError: () => void;
  reset: () => void;
}

type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await api.getProjects();
      set({ projects, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createProject: async (data: ProjectCreate) => {
    set({ isLoading: true, error: null });
    try {
      const project = await api.createProject(data);
      set(state => ({ projects: [project, ...state.projects], isLoading: false }));
      return project;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updateProject: async (id: string, data: ProjectUpdate) => {
    try {
      const updated = await api.updateProject(id, data);
      set(state => ({
        projects: state.projects.map(p => (p.id === id ? updated : p)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteProject(id);
      set(state => ({
        projects: state.projects.filter(p => p.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  getProjectDiscussions: async (id: string) => {
    return api.getProjectDiscussions(id);
  },

  getProjectById: (id: string) => get().projects.find(p => p.id === id),

  clearError: () => set({ error: null }),

  reset: () => set({ projects: [], isLoading: false, error: null }),
}));
