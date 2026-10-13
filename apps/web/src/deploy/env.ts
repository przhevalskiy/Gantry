export type DeployEnv = {
  mode: string;
  isDev: boolean;
  isProd: boolean;
  /** Public Gantry API origin, e.g. https://api.gantry.dev — empty in local dev (Vite proxy). */
  gantryApiUrl: string;
  /** Local-only — never set on Vercel production/preview. */
  devAuthBypass: boolean;
};

function trimOrigin(value: string | undefined): string {
  return value?.replace(/\/$/, '') ?? '';
}

/** Central deploy env — sole reader of Vite import.meta.env for platform wiring. */
export function resolveDeployEnv(): DeployEnv {
  const mode = import.meta.env.MODE;
  const isDev = mode === 'development';
  const isProd = mode === 'production';
  const gantryApiUrl = trimOrigin(import.meta.env.VITE_GANTRY_API_URL as string | undefined);
  const devAuthBypass = import.meta.env.VITE_GANTRY_DEV_AUTH_BYPASS === 'true';

  return {
    mode,
    isDev,
    isProd,
    gantryApiUrl,
    devAuthBypass,
  };
}

/** Throws in production build/runtime when required deploy env is missing. */
export function assertProductionDeployEnv(env: DeployEnv = resolveDeployEnv()): void {
  if (!env.isProd) return;
  if (env.devAuthBypass) {
    throw new Error('VITE_GANTRY_DEV_AUTH_BYPASS must not be set in production');
  }
  if (!env.gantryApiUrl) {
    throw new Error('VITE_GANTRY_API_URL is required in production (Vercel env)');
  }
}

export function gantryBaseUrl(env: DeployEnv = resolveDeployEnv()): string {
  return env.gantryApiUrl;
}

export function gantryDocsUrl(env: DeployEnv = resolveDeployEnv()): string {
  const base = env.gantryApiUrl;
  return `${base || 'http://localhost:8001'}/docs`;
}

export const GANTRY_DEV_AUTH_BYPASS = resolveDeployEnv().devAuthBypass;
