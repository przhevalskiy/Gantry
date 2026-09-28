import { describe, expect, it } from 'vitest';
import { findMarkForUrl } from './storage';
import type { ClientMark } from './types';

describe('findMarkForUrl', () => {
  const marks: ClientMark[] = [
    { id: '1', urlMatch: 'acct_123', label: 'Acme', color: 'coral', createdAt: 1 },
  ];

  it('matches substring', () => {
    expect(findMarkForUrl(marks, 'https://example.com/?acct_123')?.label).toBe('Acme');
  });

  it('misses when absent', () => {
    expect(findMarkForUrl(marks, 'https://example.com/')).toBeUndefined();
  });
});
