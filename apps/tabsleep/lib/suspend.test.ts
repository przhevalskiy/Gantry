import { describe, expect, it } from 'vitest';
import { shouldSuspendTab } from './suspend';
import { DEFAULT_SETTINGS } from './types';

describe('shouldSuspendTab', () => {
  const base = { ...DEFAULT_SETTINGS, idleMinutes: 10 };
  const now = 1_000_000;

  it('skips active pinned audible', () => {
    expect(shouldSuspendTab({ id: 1, active: true, url: 'https://a.com', lastAccessed: 0 }, base, now)).toBe(
      false,
    );
    expect(
      shouldSuspendTab({ id: 1, pinned: true, url: 'https://a.com', lastAccessed: 0 }, base, now),
    ).toBe(false);
    expect(
      shouldSuspendTab({ id: 1, audible: true, url: 'https://a.com', lastAccessed: 0 }, base, now),
    ).toBe(false);
  });

  it('suspends old http tabs', () => {
    expect(
      shouldSuspendTab(
        { id: 2, url: 'https://a.com', lastAccessed: now - 11 * 60_000 },
        base,
        now,
      ),
    ).toBe(true);
  });
});
