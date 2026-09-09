const KEY = 'gantry_user_settings_v1';

export type GantryUserSettings = {
  githubToken: string;
};

const DEFAULTS: GantryUserSettings = {
  githubToken: '',
};

export function getUserSettings(): GantryUserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<GantryUserSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveUserSettings(next: GantryUserSettings): void {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function getGithubToken(): string {
  return getUserSettings().githubToken.trim();
}
