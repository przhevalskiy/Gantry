import { describe, expect, it } from 'vitest';
import { buildSummaryPrompt } from './extract';

describe('buildSummaryPrompt', () => {
  it('includes title and asks for bullets by default', () => {
    const p = buildSummaryPrompt('Hello', 'World content here');
    expect(p).toContain('Hello');
    expect(p).toContain('bullet');
    expect(p).toContain('World content');
  });
  it('supports short and eli5 modes', () => {
    expect(buildSummaryPrompt('T', 'body', 'short')).toContain('2–3 short sentences');
    expect(buildSummaryPrompt('T', 'body', 'eli5')).toContain('12-year-old');
  });
});
