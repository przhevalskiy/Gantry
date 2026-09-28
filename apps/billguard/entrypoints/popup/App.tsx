import { useEffect, useState } from 'react';
import { deleteClient, listClients, loadState, saveState, upsertClient } from '@/lib/storage';
import { COLORS, type ClientGuard, type GuardColor } from '@/lib/types';

export default function App() {
  const [clients, setClients] = useState<ClientGuard[]>([]);
  const [label, setLabel] = useState('');
  const [urlMatch, setUrlMatch] = useState('');
  const [color, setColor] = useState<GuardColor>('coral');
  const [enabled, setEnabled] = useState(true);
  const [requireTyped, setRequireTyped] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = async () => {
    setClients(await listClients());
    const state = await loadState();
    setEnabled(state.settings.enabled);
    setRequireTyped(state.settings.requireTypedConfirm);
  };

  useEffect(() => {
    void refresh();
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url) {
        try {
          const u = new URL(tab.url);
          setUrlMatch(u.hostname + u.pathname.slice(0, 40));
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
        <p className="brand text-[1.45rem] font-extrabold">BillGuard</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Confirm the right client before Meta / Google Ads billing changes.
        </p>
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
            placeholder="act=123456 or customer id"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(COLORS) as GuardColor[]).map((c) => (
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
              await upsertClient({ label, urlMatch, color });
              setLabel('');
              await refresh();
              flash('Client saved');
            } catch (err) {
              flash(err instanceof Error ? err.message : 'Save failed');
            }
          }}
        >
          Save client guard
        </button>
        <label className="flex items-center justify-between text-[12px] text-[var(--soft)]">
          Guard enabled
          <input
            type="checkbox"
            checked={enabled}
            onChange={async (e) => {
              const state = await loadState();
              state.settings.enabled = e.target.checked;
              await saveState(state);
              setEnabled(e.target.checked);
            }}
          />
        </label>
        <label className="flex items-center justify-between text-[12px] text-[var(--soft)]">
          Type client name to confirm
          <input
            type="checkbox"
            checked={requireTyped}
            onChange={async (e) => {
              const state = await loadState();
              state.settings.requireTypedConfirm = e.target.checked;
              await saveState(state);
              setRequireTyped(e.target.checked);
            }}
          />
        </label>
      </section>

      <section className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl">
        {clients.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-[var(--soft)]">
            No clients yet. Save a URL match for each ads account.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {clients.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: COLORS[c.color].hex }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{c.label}</p>
                  <p className="truncate text-[10px] text-[var(--soft)]">{c.urlMatch}</p>
                </div>
                <button
                  type="button"
                  className="text-[11px] text-red-600"
                  onClick={async () => {
                    await deleteClient(c.id);
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
        <div className="fixed right-3 bottom-3 left-3 rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-[var(--accent)]">
          {status}
        </div>
      ) : null}
    </div>
  );
}
