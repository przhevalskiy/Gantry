import { describe, expect, it } from 'vitest';
import { createStarterSnippets } from './starters';
import { normalizeShortcut } from './shortcuts';

describe('ReplyKit starters', () => {
  it('seeds Upwork-focused macros with shortcuts', () => {
    const snippets = createStarterSnippets(1_700_000_000_000);
    expect(snippets.length).toBeGreaterThanOrEqual(5);
    expect(snippets.every((s) => s.shortcut.startsWith(';'))).toBe(true);
    expect(snippets.some((s) => s.niche === 'upwork')).toBe(true);
  });
});

describe('normalizeShortcut', () => {
  it('prefixes semicolon and lowercases', () => {
    expect(normalizeShortcut('Intro')).toBe(';intro');
    expect(normalizeShortcut(';Bump')).toBe(';bump');
    expect(normalizeShortcut('   ')).toBe('');
  });
});
