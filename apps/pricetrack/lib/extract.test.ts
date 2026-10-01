import { describe, expect, it } from 'vitest';
import { priceDelta, priceRange, sparklinePath } from './extract';

describe('priceDelta', () => {
  it('returns null with <2 points', () => {
    expect(priceDelta([{ price: 10 }])).toBeNull();
  });
  it('computes drop', () => {
    expect(priceDelta([{ price: 20 }, { price: 15 }])).toBe(-5);
  });
});

describe('priceRange', () => {
  it('returns null for empty', () => {
    expect(priceRange([])).toBeNull();
  });
  it('finds low and high', () => {
    expect(priceRange([{ price: 12 }, { price: 9 }, { price: 15 }])).toEqual({ low: 9, high: 15 });
  });
});

describe('sparklinePath', () => {
  it('empty for single point', () => {
    expect(sparklinePath([10])).toBe('');
  });
  it('builds path for series', () => {
    const path = sparklinePath([10, 12, 8]);
    expect(path.startsWith('M')).toBe(true);
    expect(path.includes('L')).toBe(true);
  });
});
