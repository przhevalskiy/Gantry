import { describe, expect, it } from 'vitest';
import { parseTargetUrl } from './storage';

describe('parseTargetUrl', () => {
  it('parses Gorgias', () => {
    expect(parseTargetUrl('https://acme.gorgias.com/app/tickets')?.kind).toBe('gorgias');
  });
  it('parses Zendesk', () => {
    expect(parseTargetUrl('https://acme.zendesk.com/agent/home')?.handle).toBe('acme');
  });
  it('parses Intercom', () => {
    expect(parseTargetUrl('https://app.intercom.com/a/apps/abc123')?.handle).toBe('abc123');
  });
  it('rejects other hosts', () => {
    expect(parseTargetUrl('https://example.com')).toBeNull();
  });
});
