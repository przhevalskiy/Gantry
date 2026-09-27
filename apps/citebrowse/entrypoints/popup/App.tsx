import { useEffect, useState } from 'react';
import { exportAllBibTeX, toBibTeX } from '@/lib/bibtex';
import { extractCitationMeta } from '@/lib/extract';
import { addCitation, clearCitations, deleteCitation, loadState } from '@/lib/storage';
import type { Citation } from '@/lib/types';

export default function App() {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => setCitations((await loadState()).citations);
  useEffect(() => {
    void refresh();
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2200);
  };

  const capture = async () => {
    setBusy(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractCitationMeta,
      });
      const meta = results?.[0]?.result;
      if (!meta?.title) throw new Error('No metadata found on this page');
      await addCitation({ ...meta, note: '' });
      await refresh();
      flash('Citation captured');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Capture failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[540px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">CiteBrowse</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Cite-as-you-browse — pull publisher metadata, export BibTeX.
        </p>
      </header>

      <div className="flex gap-2">
        <button type="button" className="btn flex-1 rounded-xl py-2.5 text-[13px]" disabled={busy} onClick={() => void capture()}>
          {busy ? 'Capturing…' : 'Capture this page'}
        </button>
        <button
          type="button"
          className="btn-ghost rounded-xl px-3 text-[12px]"
          onClick={async () => {
            await navigator.clipboard.writeText(exportAllBibTeX(citations));
            flash('All BibTeX copied');
          }}
        >
          Export all
        </button>
        <button
          type="button"
          className="btn-ghost rounded-xl px-2 text-[11px]"
          onClick={async () => {
            await clearCitations();
            await refresh();
          }}
        >
          Clear
        </button>
      </div>

      <section className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl">
        {citations.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12px] text-[var(--soft)]">
            Open a paper/publisher page and capture citation metadata.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {citations.map((c) => (
              <li key={c.id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{c.title}</p>
                    <p className="truncate text-[10px] text-[var(--soft)]">
                      {c.authors || 'Unknown author'} · {c.year || 'n.d.'} · <code>{c.citeKey}</code>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      className="text-[10px] font-semibold"
                      onClick={async () => {
                        await navigator.clipboard.writeText(toBibTeX(c));
                        flash('BibTeX copied');
                      }}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="text-[10px] text-red-600"
                      onClick={async () => {
                        await deleteCitation(c.id);
                        await refresh();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {status ? (
        <div className="fixed right-3 bottom-3 left-3 rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-white">
          {status}
        </div>
      ) : null}
    </div>
  );
}
