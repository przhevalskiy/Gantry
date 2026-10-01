import { describe, expect, it } from 'vitest';
import { buildSummaryPrompt } from './extract';

describe('buildSummaryPrompt', () => {
  it('includes title and asks for bullets', () => {
    const p = buildSummaryPrompt('Hello', 'World content here');
    expect(p).toContain('Hello');
    expect(p).toContain('bullet');
    expect(p).toContain('World content');
  });
});
