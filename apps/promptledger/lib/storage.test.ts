import { describe, expect, it } from 'vitest';
import { exportMarkdown } from './storage';
import type { AuditEntry } from './types';

describe('exportMarkdown', () => {
  it('includes entries and client filter', () => {
    const entries: AuditEntry[] = [
      {
        id: '1',
        kind: 'prompt',
        text: 'Write a summary',
        sourceUrl: 'https://chatgpt.com',
        sourceTitle: 'ChatGPT',
        clientTag: 'Acme',
        createdAt: 1,
      },
      {
        id: '2',
        kind: 'output',
        text: 'Here is a summary',
        sourceUrl: '',
        sourceTitle: '',
        clientTag: 'Other',
        createdAt: 2,
      },
    ];
    const md = exportMarkdown(entries, 'Acme');
    expect(md).toContain('Client: Acme');
    expect(md).toContain('Write a summary');
    expect(md).not.toContain('Here is a summary');
  });
});
