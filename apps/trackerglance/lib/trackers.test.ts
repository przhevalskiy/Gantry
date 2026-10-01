import { describe, expect, it } from 'vitest';
import { privacyScore, scanTrackersFromHtml } from './trackers';

describe('scanTrackersFromHtml', () => {
  it('finds GA and Meta', () => {
    const html =
      '<script src="https://www.google-analytics.com/analytics.js"></script><script>fbq("init")</script>';
    const hits = scanTrackersFromHtml(html, []);
    expect(hits.some((h) => h.id === 'ga')).toBe(true);
    expect(hits.some((h) => h.id === 'fb')).toBe(true);
  });
  it('finds DoubleClick and Clarity', () => {
    const html =
      '<script src="https://www.googlesyndication.com/pagead.js"></script><script src="https://www.clarity.ms/tag/x"></script>';
    const hits = scanTrackersFromHtml(html, []);
    expect(hits.some((h) => h.id === 'doubleclick')).toBe(true);
    expect(hits.some((h) => h.id === 'clarity')).toBe(true);
  });
  it('returns empty on clean page', () => {
    expect(scanTrackersFromHtml('<html><body>hi</body></html>', [])).toEqual([]);
  });
});

describe('privacyScore', () => {
  it('is 100 with no hits', () => {
    expect(privacyScore(0)).toBe(100);
  });
  it('drops with hits', () => {
    expect(privacyScore(3)).toBe(76);
    expect(privacyScore(20)).toBe(0);
  });
});
