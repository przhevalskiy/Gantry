import { create } from 'zustand';
import { useDiscussionStore } from '@/features/discussions';
import { GANTRY_DEV_AUTH_BYPASS } from '@/shared/services/gantry/config';
import { clearApiKey, hasApiKey, setApiKey } from '@/shared/services/gantry/apiKeyStore';
import { gantryGuestUser, type AuthUser } from '@/shared/types/authUser';

interface AuthState {
  user: AuthUser | null;
  session: null;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  initialize: () => Promise<void>;
  signInWithApiKey: (apiKey: string) => void;
  signOut: () => Promise<void>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isInitializing: true,
  isLoading: false,
  error: null,

  initialize: async () => {
    set({
      session: null,
      user: GANTRY_DEV_AUTH_BYPASS || hasApiKey() ? gantryGuestUser() : null,
      isInitializing: false,
    });
  },

  signInWithApiKey: (apiKey: string) => {
    setApiKey(apiKey);
    set({ user: gantryGuestUser(), session: null, error: null });
  },

  signOut: async () => {
    clearApiKey();
    useDiscussionStore.getState().reset();
    set({ user: null, session: null });
  },

  clearError: () => set({ error: null }),
}));
