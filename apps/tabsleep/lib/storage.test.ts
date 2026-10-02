import { describe, expect, it } from 'vitest';
import { clampIdleMinutes } from './storage';

describe('clampIdleMinutes', () => {
  it('bounds', () => {
    expect(clampIdleMinutes(0)).toBe(1);
    expect(clampIdleMinutes(999)).toBe(240);
    expect(clampIdleMinutes(15)).toBe(15);
  });
});
