/** Local operator identity — API-key auth does not use Supabase. */
export type AuthUser = {
  id: string;
  email: string;
  user_metadata: {
    display_name?: string;
    preferred_name?: string;
    avatar_icon?: string;
  };
};

export function gantryGuestUser(): AuthUser {
  return {
    id: 'gantry-local',
    email: 'operator@gantry.local',
    user_metadata: {
      display_name: 'Operator',
      preferred_name: 'Operator',
      avatar_icon: 'user',
    },
  };
}
