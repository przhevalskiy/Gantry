import { describe, expect, it } from 'vitest';
import { parseTargetUrl } from './storage';

describe('parseTargetUrl', () => {
  it('parses klaviyo.com', () => {
    expect(parseTargetUrl('https://www.klaviyo.com/dashboard')?.kind).toBe('klaviyo');
  });
  it('rejects others', () => {
    expect(parseTargetUrl('https://mailchimp.com')).toBeNull();
  });
});
