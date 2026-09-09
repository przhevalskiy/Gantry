/** Gantry platform mode — Gantry web shell, Gantry :8001 backend (M2). */
export const GANTRY_PLATFORM =
  import.meta.env.VITE_GANTRY_PLATFORM !== 'false';

/** Local dev — skip API key modal; Gantry API must set GANTRY_DEV_AUTH_BYPASS=true. */
export const GANTRY_DEV_AUTH_BYPASS =
  import.meta.env.VITE_GANTRY_DEV_AUTH_BYPASS === 'true';

export function gantryBaseUrl(): string {
  const configured = import.meta.env.VITE_GANTRY_API_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, '');
  return '';
}
