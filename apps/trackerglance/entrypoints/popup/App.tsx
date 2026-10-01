import { useEffect, useState } from 'react';
import { loadLastScan, saveLastScan } from '@/lib/storage';
import { privacyScore, scanPageTrackers } from '@/lib/trackers';
import type { GlanceScan } from '@/lib/types';

export default function App() {
  const [scan, setScan] = useState<GlanceScan | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const run = async (silent = false) => {
    setBusy(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanPageTrackers,
      });
      const payload = results?.[0]?.result;
      if (!payload) throw new Error('Could not scan this page');
      const next: GlanceScan = {
        url: payload.url,
        title: payload.title,
        at: Date.now(),
        hits: payload.hits,
      };
      await saveLastScan(next);
      setScan(next);
      if (!silent) {
        setStatus(next.hits.length ? `${next.hits.length} known trackers` : 'No known trackers found');
        window.setTimeout(() => setStatus(null), 2200);
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Scan failed');
      window.setTimeout(() => setStatus(null), 2200);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadLastScan<GlanceScan>().then((s) => setScan(s));
    void run(true);
  }, []);

  const score = scan ? privacyScore(scan.hits.length) : null;
  const byCat =
    scan?.hits.reduce<Record<string, number>>((acc, h) => {
      acc[h.category] = (acc[h.category] || 0) + 1;
      return acc;
    }, {}) ?? {};

  return (
    <div className="flex min-h-[520px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">TrackerGlance</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          See known trackers and ads scripts on this page. Read-only — nothing is blocked.
        </p>
      </header>

      <button type="button" className="btn rounded-xl py-2.5 text-[13px]" disabled={busy} onClick={() => void run()}>
        {busy ? 'Scanning…' : 'Rescan this tab'}
      </button>

      {scan ? (
        <section className="panel flex min-h-0 flex-1 flex-col rounded-2xl p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{scan.title || 'Page'}</p>
              <p className="truncate text-[10px] text-[var(--soft)]">{scan.url}</p>
            </div>
            <div className="text-right">
              <div className="rounded-xl bg-[var(--ink)] px-2.5 py-1 text-[13px] font-bold text-[var(--accent)]">
                {score}
              </div>
              <p className="mt-0.5 text-[9px] uppercase tracking-wide text-[var(--soft)]">score</p>
            </div>
          </div>
          {Object.keys(byCat).length > 0 ? (
            <p className="mt-2 text-[10px] text-[var(--soft)]">
              {Object.entries(byCat)
                .map(([k, v]) => `${v} ${k}`)
                .join(' · ')}
            </p>
          ) : null}
          <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
            {scan.hits.length === 0 ? (
              <li className="text-[12px] text-[var(--soft)]">No matches from the known-tracker list.</li>
            ) : (
              scan.hits.map((h) => (
                <li key={h.id} className="rounded-xl border border-[var(--line)] bg-white/60 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold">{h.label}</span>
                    <span className="text-[10px] uppercase text-[var(--soft)]">{h.category}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--soft)]">{h.evidence}</p>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : (
        <section className="panel flex flex-1 items-center justify-center rounded-2xl p-6 text-center text-[12px] text-[var(--soft)]">
          {busy ? 'Scanning…' : 'Open any website, then scan.'}
        </section>
      )}

      {status ? (
        <div className="fixed right-3 bottom-3 left-3 rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-[var(--accent)]">
          {status}
        </div>
      ) : null}
    </div>
  );
}
