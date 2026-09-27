import type { HealthCheck } from './types';

export function scoreChecks(checks: HealthCheck[]): number {
  if (!checks.length) return 0;
  const weight = { pass: 100, info: 80, warn: 45, fail: 0 } as const;
  const total = checks.reduce((sum, c) => sum + weight[c.severity], 0);
  return Math.round(total / checks.length);
}
