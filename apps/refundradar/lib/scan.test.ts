import { describe, expect, it } from 'vitest';
import { spikeScore } from './scan';

describe('spikeScore', () => {
  it('scores spikes higher than ok', () => {
    const spike = spikeScore([{ severity: 'spike' }, { severity: 'spike' }]);
    const ok = spikeScore([{ severity: 'ok' }, { severity: 'ok' }]);
    expect(spike).toBeGreaterThan(ok);
  });

  it('returns 0 for empty', () => {
    expect(spikeScore([])).toBe(0);
  });
});
