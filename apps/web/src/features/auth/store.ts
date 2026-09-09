import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/shared/services/supabase';
import { useDiscussionStore } from '@/features/discussions';
import { GANTRY_DEV_AUTH_BYPASS, GANTRY_PLATFORM } from '@/shared/services/gantry/config';
import { clearApiKey, hasApiKey, setApiKey } from '@/shared/services/gantry/apiKeyStore';
import { gantryGuestUser } from '@/shared/services/gantry/gantryGuestUser';

interface AuthState {
  user: User | null;
  session: Session | null;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, displayName?: string, avatarIcon?: string, preferredName?: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithApiKey: (apiKey: string) => void;
  signOut: () => Promise<void>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  // State
  user: null,
  session: null,
  isInitializing: true,
  isLoading: false,
  error: null,

  // Actions
  initialize: async () => {
    if (GANTRY_PLATFORM) {
      set({
        session: null,
        user: GANTRY_DEV_AUTH_BYPASS || hasApiKey() ? gantryGuestUser() : null,
        isInitializing: false,
      });
      return;
    }

    try {
      // Get current session (will automatically exchange tokens from URL if present)
      const { data: { session } } = await supabase.auth.getSession();

      set({
        session,
        user: session?.user ?? null,
        isInitializing: false,
      });

      // Listen for auth state changes (including email confirmations)
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state change:', event, session?.user?.email);

        // Handle email confirmation
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          set({
            session,
            user: session?.user ?? null,
            isInitializing: false,
          });
        } else if (event === 'SIGNED_OUT') {
          set({
            session: null,
            user: null,
          });
        } else {
          set({
            session,
            user: session?.user ?? null,
          });
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isInitializing: false });
    }
  },

  signUp: async (email: string, password: string, displayName?: string, avatarIcon?: string, preferredName?: string) => {
    set({ error: null, isLoading: true });
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0],
          avatar_icon: avatarIcon || 'user',
          preferred_name: preferredName || '',
        },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      const msg = error.message.toLowerCase().includes('rate limit')
        ? 'Too many sign-up attempts. Please wait a few minutes and try again.'
        : error.message;
      set({ error: msg, isLoading: false });
      return false;
    }
    set({ isLoading: false });
    return true;
  },

  signIn: async (email: string, password: string) => {
    set({ error: null, isLoading: true });
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  signInWithApiKey: (apiKey: string) => {
    setApiKey(apiKey);
    set({ user: gantryGuestUser(), session: null, error: null });
  },

  signOut: async () => {
    if (GANTRY_PLATFORM) {
      clearApiKey();
      useDiscussionStore.getState().reset();
      set({ user: null, session: null });
      return;
    }
    await supabase.auth.signOut();
    useDiscussionStore.getState().reset();
    set({ user: null, session: null });
  },

  clearError: () => set({ error: null }),
}));
