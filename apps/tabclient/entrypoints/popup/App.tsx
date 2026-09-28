import { useEffect, useState } from 'react';
import { deleteMark, listMarks, loadState, saveState, upsertMark } from '@/lib/storage';
import { COLORS, type ClientMark, type MarkColor } from '@/lib/types';

export default function App() {
  const [marks, setMarks] = useState<ClientMark[]>([]);
  const [label, setLabel] = useState('');
  const [urlMatch, setUrlMatch] = useState('');
  const [color, setColor] = useState<MarkColor>('coral');
  const [renameTabs, setRenameTabs] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = async () => {
    setMarks(await listMarks());
    const state = await loadState();
    setRenameTabs(state.settings.renameTabs);
  };

  useEffect(() => {
    void refresh();
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url) {
        try {
          const u = new URL(tab.url);
          setUrlMatch(u.hostname + u.pathname.slice(0, 48));
        } catch {
          setUrlMatch(tab.url.slice(0, 60));
        }
      }
    });
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="flex min-h-[500px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.45rem] font-extrabold">TabClient</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">Color and rename browser tabs by client on allowlisted SaaS admin hosts only.</p>
      </header>

      <section className="panel space-y-2 rounded-2xl p-3">
        <label className="block text-[11px] font-medium text-[var(--soft)]">
          Client label
          <input
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[13px] outline-none"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Acme Co"
          />
        </label>
        <label className="block text-[11px] font-medium text-[var(--soft)]">
          URL contains
          <input
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[13px] outline-none"
            value={urlMatch}
            onChange={(e) => setUrlMatch(e.target.value)}
            placeholder="account id or path fragment"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(COLORS) as MarkColor[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full border-2"
              style={{
                background: COLORS[c].hex,
                borderColor: color === c ? 'var(--ink)' : 'transparent',
              }}
              title={COLORS[c].label}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn w-full rounded-xl py-2.5 text-[13px]"
          onClick={async () => {
            try {
              await upsertMark({ label, urlMatch, color });
              setLabel('');
              await refresh();
              flash('Marked');
            } catch (err) {
              flash(err instanceof Error ? err.message : 'Save failed');
            }
          }}
        >
          Save mark
        </button>
        <label className="flex items-center justify-between text-[12px] text-[var(--soft)]">
          Rename tab titles
          <input
            type="checkbox"
            checked={renameTabs}
            onChange={async (e) => {
              const state = await loadState();
              state.settings.renameTabs = e.target.checked;
              await saveState(state);
              setRenameTabs(e.target.checked);
            }}
          />
        </label>
      </section>

      <section className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl">
        {marks.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-[var(--soft)]">No marks yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {marks.map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[m.color].hex }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{m.label}</p>
                  <p className="truncate text-[10px] text-[var(--soft)]">{m.urlMatch}</p>
                </div>
                <button
                  type="button"
                  className="text-[11px] text-red-600"
                  onClick={async () => {
                    await deleteMark(m.id);
                    await refresh();
                  }}
                >
                  Delete
                </button>
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
