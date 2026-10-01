import { useEffect, useState } from 'react';
import { extractPriceFromPage, priceDelta } from '@/lib/extract';
import { deleteWatch, loadState, upsertWatch } from '@/lib/storage';
import type { WatchedItem } from '@/lib/types';

export default function App() {
  const [items, setItems] = useState<WatchedItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [couponNote, setCouponNote] = useState('');

  const refresh = async () => setItems((await loadState()).items);
  useEffect(() => {
    void refresh();
  }, []);

  const flash = (m: string) => {
    setStatus(m);
    window.setTimeout(() => setStatus(null), 2200);
  };

  const scanAndWatch = async () => {
    setBusy(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPriceFromPage,
      });
      const payload = results?.[0]?.result;
      if (!payload) throw new Error('Could not read this page');
      if (payload.price == null) throw new Error('No price found on this page');
      await upsertWatch({
        url: payload.url,
        title: payload.title,
        note: couponNote,
        point: {
          at: Date.now(),
          price: payload.price,
          currency: payload.currency,
          raw: payload.raw,
        },
      });
      setCouponNote('');
      await refresh();
      flash(`Watching at ${payload.currency} ${payload.price}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[520px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">PriceTrack</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          POC — local price history on product pages. No coupon auto-inject.
        </p>
      </header>

      <section className="panel space-y-2 rounded-2xl p-3">
        <input
          className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
          placeholder="Optional coupon note (you paste — we don’t inject)"
          value={couponNote}
          onChange={(e) => setCouponNote(e.target.value)}
        />
        <button type="button" className="btn w-full rounded-xl py-2.5 text-[13px]" disabled={busy} onClick={() => void scanAndWatch()}>
          {busy ? 'Scanning…' : 'Watch price on this tab'}
        </button>
      </section>

      <section className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl">
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12px] text-[var(--soft)]">
            Open a product page, then watch the price.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {items.map((item) => {
              const last = item.history[item.history.length - 1];
              const delta = priceDelta(item.history);
              return (
                <li key={item.id} className="px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => void browser.tabs.create({ url: item.url })}
                    >
                      <p className="truncate text-[13px] font-semibold">{item.title}</p>
                      <p className="text-[12px] font-bold">
                        {last ? `${last.currency} ${last.price}` : '—'}
                        {delta != null ? (
                          <span style={{ color: delta < 0 ? 'var(--accent-ink)' : delta > 0 ? 'var(--fail)' : 'var(--soft)' }}>
                            {' '}
                            ({delta > 0 ? '+' : ''}
                            {delta})
                          </span>
                        ) : null}
                      </p>
                      {item.note ? <p className="truncate text-[10px] text-[var(--soft)]">Note: {item.note}</p> : null}
                    </button>
                    <button type="button" className="text-[10px] text-red-600" onClick={() => void deleteWatch(item.id).then(refresh)}>
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
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
