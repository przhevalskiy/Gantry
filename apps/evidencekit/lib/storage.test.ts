import { describe, expect, it } from 'vitest';
import { checklistFromTemplate, exportEvidenceMarkdown } from './storage';
import type { EvidenceItem } from './types';

describe('EvidenceKit helpers', () => {
  it('builds checklist from template labels', () => {
    const list = checklistFromTemplate(['A', 'B']);
    expect(list).toHaveLength(2);
    expect(list.every((c) => !c.done)).toBe(true);
  });

  it('exports markdown with checklist state', () => {
    const item: EvidenceItem = {
      id: '1',
      title: 'Privacy review',
      url: 'https://example.com',
      pageTitle: 'Example',
      note: 'Looks good',
      screenshotDataUrl: 'data:image/png;base64,xx',
      checklist: [{ id: 'a', label: 'Policy linked', done: true }],
      capturedAt: 1,
    };
    const md = exportEvidenceMarkdown(item);
    expect(md).toContain('[x] Policy linked');
    expect(md).toContain('Looks good');
  });
});
