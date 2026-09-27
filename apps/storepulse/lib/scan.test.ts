import { describe, expect, it } from 'vitest';
import { scoreChecks } from './score';
import type { HealthCheck } from './types';

describe('scoreChecks', () => {
  it('scores all-pass highly', () => {
    const checks: HealthCheck[] = [
      { id: 'a', label: 'A', severity: 'pass', detail: '' },
      { id: 'b', label: 'B', severity: 'pass', detail: '' },
    ];
    expect(scoreChecks(checks)).toBe(100);
  });

  it('penalizes fails', () => {
    const checks: HealthCheck[] = [
      { id: 'a', label: 'A', severity: 'pass', detail: '' },
      { id: 'b', label: 'B', severity: 'fail', detail: '' },
    ];
    expect(scoreChecks(checks)).toBe(50);
  });
});
