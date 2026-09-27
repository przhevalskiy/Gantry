import { describe, expect, it } from 'vitest';
import { createStarterProfiles } from './starters';
import { fieldsToText } from './storage';

describe('FormPack starters', () => {
  it('seeds shipping grant and admin packs', () => {
    const profiles = createStarterProfiles(1);
    expect(profiles.some((p) => p.niche === 'shipping')).toBe(true);
    expect(profiles.some((p) => p.niche === 'grant')).toBe(true);
    expect(profiles.every((p) => p.fields.length > 0)).toBe(true);
  });

  it('serializes fields', () => {
    expect(fieldsToText([{ key: 'email', value: 'a@b.c' }])).toBe('email=a@b.c');
  });
});
