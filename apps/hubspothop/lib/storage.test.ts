import { describe, expect, it } from 'vitest';
import { parseTargetUrl } from './storage';

describe('parseTargetUrl', () => {
  it('parses portal from contacts path', () => {
    const p = parseTargetUrl('https://app.hubspot.com/contacts/1234567/objects/0-1');
    expect(p?.handle).toBe('1234567');
  });
  it('rejects others', () => {
    expect(parseTargetUrl('https://salesforce.com')).toBeNull();
  });
});
