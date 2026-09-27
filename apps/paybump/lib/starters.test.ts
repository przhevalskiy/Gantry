import { describe, expect, it } from 'vitest';
import { createStarterMacros } from './starters';
import { normalizeShortcut } from './storage';

describe('PayBump starters', () => {
  it('seeds stripe and invoice macros with shortcuts', () => {
    const macros = createStarterMacros(1);
    expect(macros.length).toBeGreaterThanOrEqual(4);
    expect(macros.every((m) => m.shortcut.startsWith(';'))).toBe(true);
    expect(macros.some((m) => m.niche === 'stripe')).toBe(true);
  });
});

describe('normalizeShortcut', () => {
  it('prefixes semicolon', () => {
    expect(normalizeShortcut('card')).toBe(';card');
    expect(normalizeShortcut(';D3')).toBe(';d3');
  });
});
