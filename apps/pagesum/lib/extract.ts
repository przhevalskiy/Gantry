import type { SummaryMode } from './types';

/** Page-world article text extractor */
export function extractPageText(): { title: string; url: string; text: string } {
  const url = location.href;
  const title = document.title;
  const main =
    document.querySelector('article') ||
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.body;
  let text = (main?.innerText || '').replace(/\s+/g, ' ').trim();
  if (text.length > 12000) text = text.slice(0, 12000);
  return { title, url, text };
}

export function buildSummaryPrompt(title: string, text: string, mode: SummaryMode = 'bullets'): string {
  const instruction =
    mode === 'short'
      ? 'Summarize the following web page in 2–3 short sentences for a busy reader.'
      : mode === 'eli5'
        ? 'Explain the following web page simply, as if to a smart 12-year-old. Use short paragraphs. No jargon.'
        : 'Summarize the following web page in 5 short bullet points for a busy reader.';
  return [instruction, 'Be factual. No preamble.', '', `Title: ${title}`, '', text.slice(0, 10000)].join(
    '\n',
  );
}
