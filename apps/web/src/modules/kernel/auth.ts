import { create } from 'zustand';
import { GANTRY_DEV_AUTH_BYPASS } from '@/shared/services/gantry/config';
import { clearApiKey, hasApiKey, setApiKey } from '@/shared/services/gantry/apiKeyStore';
import { gantryGuestUser, type AuthUser } from '@/shared/types/authUser';

type AuthStore = {
  user: AuthUser | null;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  signInWithApiKey: (apiKey: string) => void;
  signOut: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthStore>(set => ({
  user: null,
  isInitializing: true,
  isLoading: false,
  error: null,

  initialize: async () => {
    set({
      user: GANTRY_DEV_AUTH_BYPASS || hasApiKey() ? gantryGuestUser() : null,
      isInitializing: false,
    });
  },

  signInWithApiKey: (apiKey: string) => {
    setApiKey(apiKey);
    set({ user: gantryGuestUser(), error: null });
  },

  signOut: async () => {
    clearApiKey();
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));
