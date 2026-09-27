import { makeCiteKey } from './bibtex';
import { STORAGE_KEY, type Citation, type CiteBrowseState } from './types';

function empty(): CiteBrowseState {
  return { version: 1, citations: [], settings: { pro: { enabled: false } } };
}

export async function loadState(): Promise<CiteBrowseState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as CiteBrowseState | undefined;
  return stored?.version === 1 ? stored : empty();
}

export async function saveState(state: CiteBrowseState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export async function addCitation(
  partial: Omit<Citation, 'id' | 'citeKey' | 'capturedAt'> & { citeKey?: string },
): Promise<Citation> {
  const state = await loadState();
  const citation: Citation = {
    id: crypto.randomUUID(),
    citeKey: partial.citeKey || makeCiteKey(partial.authors, partial.year, partial.title),
    title: partial.title.trim(),
    authors: partial.authors.trim(),
    year: partial.year.trim(),
    journal: partial.journal.trim(),
    doi: partial.doi.trim(),
    url: partial.url.trim(),
    publisher: partial.publisher.trim(),
    note: partial.note.trim(),
    capturedAt: Date.now(),
  };
  if (!citation.title) throw new Error('Title required');
  state.citations.unshift(citation);
  state.citations = state.citations.slice(0, 300);
  await saveState(state);
  return citation;
}

export async function deleteCitation(id: string): Promise<void> {
  const state = await loadState();
  state.citations = state.citations.filter((c) => c.id !== id);
  await saveState(state);
}

export async function clearCitations(): Promise<void> {
  const state = await loadState();
  state.citations = [];
  await saveState(state);
}
