import { describe, expect, it } from 'vitest';
import { clampBoost, clampSpeed, clampVolume } from './storage';

describe('clamps', () => {
  it('speed', () => {
    expect(clampSpeed(0)).toBe(0.25);
    expect(clampSpeed(5)).toBe(3);
    expect(clampSpeed(1.5)).toBe(1.5);
  });
  it('volume', () => {
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(2)).toBe(1);
  });
  it('boost', () => {
    expect(clampBoost(0.5)).toBe(1);
    expect(clampBoost(10)).toBe(4);
  });
});
