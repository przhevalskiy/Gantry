import { useEffect, useMemo, useState } from 'react';
import {
  addEntry,
  clearEntries,
  deleteEntry,
  exportMarkdown,
  loadState,
  saveState,
} from '@/lib/storage';
import type { AuditEntry, EntryKind } from '@/lib/types';

export default function App() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<EntryKind>('prompt');
  const [clientTag, setClientTag] = useState('');
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const refresh = async () => {
    const state = await loadState();
    setEntries(state.entries);
    setClientTag(state.settings.defaultClientTag);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.text.toLowerCase().includes(q) ||
        e.clientTag.toLowerCase().includes(q) ||
        e.kind.includes(q),
    );
  }, [entries, filter]);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2000);
  };

  const captureSelection = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      flash('No active tab');
      return;
    }
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() ?? '',
    });
    const selected = (results?.[0]?.result as string | undefined)?.trim() ?? '';
    if (!selected) {
      flash('Select text on the page first');
      return;
    }
    await addEntry({
      kind,
      text: selected,
      sourceUrl: tab.url,
      sourceTitle: tab.title,
      clientTag,
    });
    setText('');
    await refresh();
    flash('Captured from selection');
  };

  return (
    <div className="flex min-h-[540px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">PromptLedger</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          AI work audit log — capture prompts/outputs, export a client trail.
        </p>
      </header>

      <section className="panel space-y-2 rounded-2xl p-3">
        <div className="flex gap-1">
          {(['prompt', 'output', 'note'] as EntryKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                kind === k ? 'bg-[var(--ink)] text-[var(--accent)]' : 'btn-ghost'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <input
          className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
          placeholder="Client tag (e.g. Acme)"
          value={clientTag}
          onChange={async (e) => {
            setClientTag(e.target.value);
            const state = await loadState();
            state.settings.defaultClientTag = e.target.value;
            await saveState(state);
          }}
        />
        <textarea
          className="h-20 w-full resize-none rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
          placeholder="Paste prompt or output…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn flex-1 rounded-xl py-2 text-[12px]"
            onClick={async () => {
              try {
                const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
                await addEntry({
                  kind,
                  text,
                  sourceUrl: tab?.url,
                  sourceTitle: tab?.title,
                  clientTag,
                });
                setText('');
                await refresh();
                flash('Saved');
              } catch (err) {
                flash(err instanceof Error ? err.message : 'Save failed');
              }
            }}
          >
            Save paste
          </button>
          <button type="button" className="btn-ghost rounded-xl px-3 text-[12px]" onClick={() => void captureSelection()}>
            From selection
          </button>
        </div>
        <p className="text-[10px] text-[var(--soft)]">Tip: right-click selected text → PromptLedger.</p>
      </section>

      <div className="flex gap-2">
        <input
          className="panel flex-1 rounded-xl px-2.5 py-2 text-[12px] outline-none"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className="btn rounded-xl px-3 text-[11px]"
          onClick={async () => {
            await navigator.clipboard.writeText(exportMarkdown(entries, clientTag || undefined));
            flash('Markdown exported');
          }}
        >
          Export
        </button>
        <button
          type="button"
          className="btn-ghost rounded-xl px-2 text-[11px]"
          onClick={async () => {
            await clearEntries();
            await refresh();
          }}
        >
          Clear
        </button>
      </div>

      <section className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl">
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12px] text-[var(--soft)]">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {filtered.map((e) => (
              <li key={e.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide">{e.kind}</span>
                  <button type="button" className="text-[10px] text-red-600" onClick={() => void deleteEntry(e.id).then(refresh)}>
                    Delete
                  </button>
                </div>
                <p className="mt-1 line-clamp-3 text-[11px] text-[var(--soft)]">{e.text}</p>
                <p className="mt-1 text-[10px] text-[var(--soft)]">
                  {e.clientTag || 'untagged'} · {new Date(e.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {status ? (
        <div className="fixed right-3 bottom-3 left-3 rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-[var(--accent)]">
          {status}
        </div>
      ) : null}
    </div>
  );
}
