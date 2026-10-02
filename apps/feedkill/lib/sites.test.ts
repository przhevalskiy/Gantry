import { describe, expect, it } from 'vitest';
import { siteFromHost, youtubeShortsWatchId } from './sites';

describe('siteFromHost', () => {
  it('detects platforms', () => {
    expect(siteFromHost('www.youtube.com')).toBe('youtube');
    expect(siteFromHost('instagram.com')).toBe('instagram');
    expect(siteFromHost('x.com')).toBe('x');
    expect(siteFromHost('twitter.com')).toBe('x');
    expect(siteFromHost('example.com')).toBeNull();
  });
});

describe('youtubeShortsWatchId', () => {
  it('extracts id', () => {
    expect(youtubeShortsWatchId('/shorts/abc123')).toBe('abc123');
    expect(youtubeShortsWatchId('/watch?v=x')).toBeNull();
  });
});
