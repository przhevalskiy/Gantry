import { describe, expect, it } from 'vitest';
import { findClientForUrl, isBillingUrl } from './storage';
import type { ClientGuard } from './types';

describe('isBillingUrl', () => {
  it('detects billing paths', () => {
    expect(isBillingUrl('https://ads.google.com/aw/billing')).toBe(true);
    expect(isBillingUrl('https://business.facebook.com/billing_hub')).toBe(true);
  });

  it('ignores non-billing paths', () => {
    expect(isBillingUrl('https://ads.google.com/aw/overview')).toBe(false);
  });
});

describe('findClientForUrl', () => {
  const clients: ClientGuard[] = [
    { id: '1', urlMatch: 'act=999', label: 'Acme', color: 'coral', createdAt: 1 },
  ];

  it('matches client substring', () => {
    expect(
      findClientForUrl(
        clients,
        'https://adsmanager.facebook.com/adsmanager/billing?act=999',
      )?.label,
    ).toBe('Acme');
  });
});
