import { useEffect, useState } from 'react';
import { extractPriceFromPage, priceDelta, priceRange, sparklinePath } from '@/lib/extract';
import { deleteWatch, loadState, setTargetPrice, upsertWatch } from '@/lib/storage';
import type { WatchedItem } from '@/lib/types';

export default function App() {
  const [items, setItems] = useState<WatchedItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [targetDraft, setTargetDraft] = useState('');

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
      const item = await upsertWatch({
        url: payload.url,
        title: payload.title,
        point: {
          at: Date.now(),
          price: payload.price,
          currency: payload.currency,
          raw: payload.raw,
        },
      });
      await refresh();
      const hitTarget =
        item.targetPrice != null && payload.price <= item.targetPrice
          ? ` · at or under target ${item.targetPrice}`
          : '';
      flash(`Watching at ${payload.currency} ${payload.price}${hitTarget}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setBusy(false);
    }
  };

  const saveTarget = async (id: string) => {
    const n = targetDraft.trim() === '' ? null : Number(targetDraft);
    if (n != null && (!Number.isFinite(n) || n <= 0)) {
      flash('Enter a valid target price');
      return;
    }
    await setTargetPrice(id, n);
    setEditingTarget(null);
    await refresh();
    flash(n == null ? 'Target cleared' : `Target set to ${n}`);
  };

  return (
    <div className="flex min-h-[520px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">PriceTrack</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Local price history on product pages. No account. No coupon injection.
        </p>
      </header>

      <button
        type="button"
        className="btn w-full rounded-xl py-2.5 text-[13px]"
        disabled={busy}
        onClick={() => void scanAndWatch()}
      >
        {busy ? 'Scanning…' : 'Watch price on this tab'}
      </button>

      <section className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl">
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12px] text-[var(--soft)]">
            Open a product page, then watch the price. Recheck later to see drops.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {items.map((item) => {
              const last = item.history[item.history.length - 1];
              const delta = priceDelta(item.history);
              const range = priceRange(item.history);
              const path = sparklinePath(item.history.map((h) => h.price));
              const underTarget =
                last && item.targetPrice != null && last.price <= item.targetPrice;
              return (
                <li key={item.id} className="px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => void browser.tabs.create({ url: item.url })}
                    >
                      <p className="truncate text-[13px] font-semibold">{item.title}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="text-[12px] font-bold">
                          {last ? `${last.currency} ${last.price}` : '—'}
                          {delta != null ? (
                            <span
                              style={{
                                color:
                                  delta < 0
                                    ? 'var(--accent-ink)'
                                    : delta > 0
                                      ? 'var(--fail)'
                                      : 'var(--soft)',
                              }}
                            >
                              {' '}
                              ({delta > 0 ? '+' : ''}
                              {delta})
                            </span>
                          ) : null}
                        </p>
                        {path ? (
                          <svg width="72" height="22" viewBox="0 0 72 22" aria-hidden className="shrink-0">
                            <path d={path} fill="none" stroke="var(--accent-ink)" strokeWidth="1.6" />
                          </svg>
                        ) : null}
                      </div>
                      {range && item.history.length > 1 ? (
                        <p className="text-[10px] text-[var(--soft)]">
                          Low {range.low} · High {range.high}
                          {underTarget ? ' · At target' : ''}
                        </p>
                      ) : underTarget ? (
                        <p className="text-[10px] font-semibold text-[var(--accent-ink)]">At or under target</p>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="text-[10px] text-red-600"
                      onClick={() => void deleteWatch(item.id).then(refresh)}
                    >
                      Delete
                    </button>
                  </div>
                  {editingTarget === item.id ? (
                    <div className="mt-2 flex gap-1.5">
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white/70 px-2 py-1.5 text-[12px] outline-none"
                        inputMode="decimal"
                        placeholder="Target price"
                        value={targetDraft}
                        onChange={(e) => setTargetDraft(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn rounded-lg px-2.5 py-1.5 text-[11px]"
                        onClick={() => void saveTarget(item.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn-ghost rounded-lg px-2 py-1.5 text-[11px]"
                        onClick={() => setEditingTarget(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mt-1.5 text-[10px] text-[var(--soft)] underline-offset-2 hover:underline"
                      onClick={() => {
                        setEditingTarget(item.id);
                        setTargetDraft(item.targetPrice != null ? String(item.targetPrice) : '');
                      }}
                    >
                      {item.targetPrice != null ? `Target ${item.targetPrice}` : 'Set target price'}
                    </button>
                  )}
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
