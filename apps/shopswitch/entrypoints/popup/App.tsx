import { useEffect, useMemo, useState } from 'react';
import {
  deleteStore,
  loadState,
  parseShopifyAdmin,
  touchOpened,
  upsertStore,
} from '@/lib/storage';
import { COLORS, type ShopStore, type StoreColor } from '@/lib/types';

export default function App() {
  const [stores, setStores] = useState<ShopStore[]>([]);
  const [label, setLabel] = useState('');
  const [adminUrl, setAdminUrl] = useState('');
  const [color, setColor] = useState<StoreColor>('mint');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const refresh = async () => setStores((await loadState()).stores);

  useEffect(() => {
    void refresh();
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url && parseShopifyAdmin(tab.url)) {
        setAdminUrl(tab.url);
        const parsed = parseShopifyAdmin(tab.url);
        if (parsed) setLabel(parsed.handle);
      }
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...stores].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
    if (!q) return list;
    return list.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.handle.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q),
    );
  }, [stores, query]);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="flex min-h-[520px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">ShopSwitch</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Agency multi-store switcher — save, label, jump between Shopify admins.
        </p>
      </header>

      <section className="panel space-y-2 rounded-2xl p-3">
        <input
          className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
          placeholder="Client label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
          placeholder="https://admin.shopify.com/store/…"
          value={adminUrl}
          onChange={(e) => setAdminUrl(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(COLORS) as StoreColor[]).map((c) => (
            <button
              key={c}
              type="button"
              className="h-7 w-7 rounded-full border-2"
              style={{ background: COLORS[c], borderColor: color === c ? 'var(--ink)' : 'transparent' }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn w-full rounded-xl py-2.5 text-[13px]"
          onClick={async () => {
            try {
              await upsertStore({ label, adminUrl, color });
              setLabel('');
              await refresh();
              flash('Store saved');
            } catch (err) {
              flash(err instanceof Error ? err.message : 'Save failed');
            }
          }}
        >
          Save current / URL
        </button>
      </section>

      <input
        className="panel rounded-xl px-2.5 py-2 text-[12px] outline-none"
        placeholder="Search stores…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <section className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl">
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12px] text-[var(--soft)]">
            No stores yet. Open a Shopify admin and save it.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {filtered.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[s.color] }} />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={async () => {
                    await touchOpened(s.id);
                    await browser.tabs.create({ url: s.adminUrl });
                    await refresh();
                  }}
                >
                  <p className="truncate text-[13px] font-semibold">{s.label}</p>
                  <p className="truncate text-[10px] text-[var(--soft)]">{s.handle}</p>
                </button>
                <button
                  type="button"
                  className="text-[10px] text-red-600"
                  onClick={async () => {
                    await deleteStore(s.id);
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
