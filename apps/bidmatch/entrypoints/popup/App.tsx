import { useEffect, useState } from 'react';
import {
  deleteSet,
  listSets,
  loadState,
  saveState,
  toggleSet,
  upsertSet,
} from '@/lib/storage';
import type { KeywordSet } from '@/lib/types';

export default function App() {
  const [sets, setSets] = useState<KeywordSet[]>([]);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [color, setColor] = useState('#c8f135');
  const [wholeWord, setWholeWord] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [matchCount, setMatchCount] = useState<number | null>(null);

  const refresh = async () => {
    setSets(await listSets());
    const state = await loadState();
    setWholeWord(state.settings.wholeWord);
  };

  useEffect(() => {
    void refresh();
    const onMsg = (msg: { type?: string; count?: number }) => {
      if (msg?.type === 'BIDMATCH_COUNT' && typeof msg.count === 'number') {
        setMatchCount(msg.count);
      }
    };
    browser.runtime.onMessage.addListener(onMsg);
    return () => browser.runtime.onMessage.removeListener(onMsg);
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2000);
  };

  const rehighlight = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await browser.tabs.sendMessage(tab.id, { type: 'BIDMATCH_REFRESH' }).catch(() => undefined);
    }
  };

  return (
    <div className="flex min-h-[520px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="brand text-[1.45rem] font-extrabold">BidMatch</p>
            <p className="mt-1 text-[12px] text-[var(--soft)]">
              Highlight RFP / job keywords from your saved searches.
            </p>
          </div>
          {matchCount != null ? (
            <div className="rounded-xl bg-[var(--ink)] px-2.5 py-1 text-[12px] font-bold text-[var(--accent)]">
              {matchCount} hits
            </div>
          ) : null}
        </div>
      </header>

      <section className="panel space-y-2 rounded-2xl p-3">
        <label className="block text-[11px] font-medium text-[var(--soft)]">
          Set name
          <input
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[13px] outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cloud skills"
          />
        </label>
        <label className="block text-[11px] font-medium text-[var(--soft)]">
          Keywords (comma separated)
          <textarea
            className="mt-1 h-16 w-full resize-none rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="kubernetes, terraform, SOC 2"
          />
        </label>
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          <button
            type="button"
            className="btn flex-1 rounded-xl py-2 text-[13px]"
            onClick={async () => {
              const kws = keywords
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean);
              if (!name.trim() || !kws.length) {
                flash('Name and keywords required');
                return;
              }
              await upsertSet({ name: name.trim(), keywords: kws, color, enabled: true });
              setName('');
              setKeywords('');
              await refresh();
              await rehighlight();
              flash('Keyword set saved');
            }}
          >
            Add set
          </button>
        </div>
        <label className="flex items-center justify-between text-[12px] text-[var(--soft)]">
          Whole-word match
          <input
            type="checkbox"
            checked={wholeWord}
            onChange={async (e) => {
              const state = await loadState();
              state.settings.wholeWord = e.target.checked;
              await saveState(state);
              setWholeWord(e.target.checked);
              await rehighlight();
            }}
          />
        </label>
        <button type="button" className="btn-ghost w-full rounded-xl py-2 text-[12px]" onClick={() => void rehighlight()}>
          Re-highlight this page
        </button>
      </section>

      <section className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl">
        <ul className="divide-y divide-[var(--line)]">
          {sets.map((s) => (
            <li key={s.id} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{s.name}</p>
                <label className="text-[10px] text-[var(--soft)]">
                  On
                  <input
                    className="ml-1"
                    type="checkbox"
                    checked={s.enabled}
                    onChange={async (e) => {
                      await toggleSet(s.id, e.target.checked);
                      await refresh();
                      await rehighlight();
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="text-[11px] text-red-600"
                  onClick={async () => {
                    await deleteSet(s.id);
                    await refresh();
                    await rehighlight();
                  }}
                >
                  Delete
                </button>
              </div>
              <p className="mt-1 text-[10px] text-[var(--soft)]">{s.keywords.join(', ')}</p>
            </li>
          ))}
        </ul>
      </section>

      {status ? (
        <div className="fixed right-3 bottom-3 left-3 rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-[var(--accent)]">
          {status}
        </div>
      ) : null}
    </div>
  );
}
