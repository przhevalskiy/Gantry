import { describe, expect, it } from 'vitest';
import { priceDelta } from './extract';

describe('priceDelta', () => {
  it('returns null with <2 points', () => {
    expect(priceDelta([{ price: 10 }])).toBeNull();
  });
  it('computes drop', () => {
    expect(priceDelta([{ price: 20 }, { price: 15 }])).toBe(-5);
  });
});
