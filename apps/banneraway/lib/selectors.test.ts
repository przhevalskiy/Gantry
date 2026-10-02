import { describe, expect, it } from 'vitest';
import { buildHideCss, isRejectLabel } from './selectors';

describe('selectors', () => {
  it('builds css', () => {
    const css = buildHideCss(['#a', '.b']);
    expect(css).toContain('#a');
    expect(css).toContain('display: none');
  });
  it('matches reject labels', () => {
    expect(isRejectLabel('Reject all')).toBe(true);
    expect(isRejectLabel('Accept all')).toBe(false);
  });
});
