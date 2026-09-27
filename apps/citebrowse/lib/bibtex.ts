import type { Citation } from './types';

export function toBibTeX(c: Citation): string {
  const fields: [string, string][] = [
    ['title', c.title],
    ['author', c.authors],
    ['year', c.year],
    ['journal', c.journal],
    ['doi', c.doi],
    ['url', c.url],
    ['publisher', c.publisher],
    ['note', c.note],
  ];
  const body = fields
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `  ${k} = {${escapeBib(v)}}`)
    .join(',\n');
  return `@article{${c.citeKey},\n${body}\n}`;
}

export function exportAllBibTeX(citations: Citation[]): string {
  return citations.map(toBibTeX).join('\n\n') + (citations.length ? '\n' : '');
}

function escapeBib(s: string): string {
  return s.replace(/[{}]/g, '');
}

export function makeCiteKey(authors: string, year: string, title: string): string {
  const last = (authors.split(/,| and /i)[0] || 'anon')
    .trim()
    .split(/\s+/)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'anon';
  const y = year.replace(/[^0-9]/g, '').slice(0, 4) || 'n.d.';
  const word = (title.split(/\s+/).find((w) => w.length > 3) || 'work')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `${last}${y}${word}`;
}
