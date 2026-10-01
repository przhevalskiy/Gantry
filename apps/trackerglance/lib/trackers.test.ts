import { describe, expect, it } from 'vitest';
import { scanTrackersFromHtml } from './trackers';

describe('scanTrackersFromHtml', () => {
  it('finds GA and Meta', () => {
    const html = '<script src="https://www.google-analytics.com/analytics.js"></script><script>fbq("init")</script>';
    const hits = scanTrackersFromHtml(html, []);
    expect(hits.some((h) => h.id === 'ga')).toBe(true);
    expect(hits.some((h) => h.id === 'fb')).toBe(true);
  });
  it('returns empty on clean page', () => {
    expect(scanTrackersFromHtml('<html><body>hi</body></html>', [])).toEqual([]);
  });
});
