import { describe, expect, it } from 'vitest';

describe('keyword escaping', () => {
  it('escapes regex metacharacters', () => {
    const keyword = 'C++ / .NET';
    const pattern = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(pattern).toContain('\\+');
    expect(pattern).toContain('\\.');
  });
});
