import { describe, expect, it } from 'vitest';
import { exportAllBibTeX, makeCiteKey, toBibTeX } from './bibtex';
import type { Citation } from './types';

const sample: Citation = {
  id: '1',
  citeKey: 'doe2020learning',
  title: 'Learning Things',
  authors: 'Jane Doe',
  year: '2020',
  journal: 'Journal of Tests',
  doi: '10.1234/test',
  url: 'https://example.com/paper',
  publisher: 'Test Press',
  note: '',
  capturedAt: 1,
};

describe('bibtex', () => {
  it('builds cite keys', () => {
    expect(makeCiteKey('Jane Doe', '2020', 'Learning Things')).toBe('doe2020learning');
  });

  it('exports bibtex entry', () => {
    const bib = toBibTeX(sample);
    expect(bib).toContain('@article{doe2020learning');
    expect(bib).toContain('title = {Learning Things}');
  });

  it('exports library', () => {
    expect(exportAllBibTeX([sample])).toContain('@article{');
  });
});
