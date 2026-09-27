import { describe, expect, it } from 'vitest';
import { parsePortalUrl } from './storage';

describe('parsePortalUrl', () => {
  it('parses QuickBooks app paths', () => {
    const parsed = parsePortalUrl('https://app.qbo.intuit.com/app/homepage');
    expect(parsed?.kind).toBe('quickbooks');
    expect(parsed?.handle).toBe('homepage');
  });

  it('parses QuickBooks companyId query', () => {
    const parsed = parsePortalUrl('https://app.qbo.intuit.com/app/homepage?companyId=123456');
    expect(parsed?.kind).toBe('quickbooks');
    expect(parsed?.handle).toBe('homepage');
  });

  it('parses Xero organisation URLs', () => {
    const parsed = parsePortalUrl('https://go.xero.com/organisation/login/user/abc');
    expect(parsed?.kind).toBe('xero');
    expect(parsed?.handle).toBe('login');
  });

  it('rejects unrelated URLs', () => {
    expect(parsePortalUrl('https://example.com')).toBeNull();
  });
});
