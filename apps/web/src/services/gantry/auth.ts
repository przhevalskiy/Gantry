/** Local API key storage. Plaintext shown once by API (I4) — we persist only what the user pastes. */

const STORAGE_KEY = "gantry.apiKey";

export function getApiKey(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

export function setApiKey(key: string | null): void {
  try {
    if (!key?.trim()) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, key.trim());
  } catch {
    /* private mode */
  }
}

export function hasApiKey(): boolean {
  return Boolean(getApiKey());
}
