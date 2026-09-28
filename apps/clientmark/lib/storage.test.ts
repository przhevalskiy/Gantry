import { describe, expect, it } from 'vitest';
import { findMarkForUrl } from './storage';
import type { ClientMark } from './types';

describe('findMarkForUrl', () => {
  const marks: ClientMark[] = [
    {
      id: '1',
      urlMatch: 'act=999',
      label: 'Acme',
      color: 'coral',
      createdAt: 1,
    },
  ];

  it('matches substring in URL', () => {
    expect(
      findMarkForUrl(marks, 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=999')
        ?.label,
    ).toBe('Acme');
  });

  it('returns undefined when no match', () => {
    expect(findMarkForUrl(marks, 'https://ads.google.com/')).toBeUndefined();
  });
});
