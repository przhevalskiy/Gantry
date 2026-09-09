import type { User } from '@supabase/supabase-js';

/** Synthetic Supabase user for Gantry platform mode (API key auth). */
export function gantryGuestUser(): User {
  return {
    id: 'gantry-local',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'operator@gantry.local',
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'gantry' },
    user_metadata: {
      display_name: 'Operator',
      preferred_name: 'Operator',
      avatar_icon: 'user',
    },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  } as User;
}
