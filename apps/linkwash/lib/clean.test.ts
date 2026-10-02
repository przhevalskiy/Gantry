import { describe, expect, it } from 'vitest';
import { cleanUrl, isProbablyUrl } from './clean';

describe('cleanUrl', () => {
  it('strips utm and fbclid', () => {
    const { cleaned, removed } = cleanUrl('https://example.com/a?utm_source=x&id=1&fbclid=abc');
    expect(cleaned).toBe('https://example.com/a?id=1');
    expect(removed.sort()).toEqual(['fbclid', 'utm_source']);
  });
  it('protects google search', () => {
    const u = 'https://www.google.com/search?q=test&utm_source=x';
    expect(cleanUrl(u).cleaned).toBe(u);
  });
  it('unwraps facebook l.php', () => {
    const inner = encodeURIComponent('https://news.example/story?utm_medium=fb&ok=1');
    const { cleaned } = cleanUrl(`https://l.facebook.com/l.php?u=${inner}`);
    expect(cleaned).toBe('https://news.example/story?ok=1');
  });
});

describe('isProbablyUrl', () => {
  it('detects urls', () => {
    expect(isProbablyUrl('https://a.com')).toBe(true);
    expect(isProbablyUrl('hello')).toBe(false);
  });
});
