import { useEffect, useState } from 'react';
import { scanShopifyPage } from '@/lib/scan';
import { scoreChecks } from '@/lib/score';
import { clearReports, formatClientReport, listReports, saveReport } from '@/lib/storage';
import type { StoreReport } from '@/lib/types';


export default function App() {
  const [reports, setReports] = useState<StoreReport[]>([]);
  const [current, setCurrent] = useState<StoreReport | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => setReports(await listReports());

  useEffect(() => {
    void refresh();
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2200);
  };

  const runScan = async () => {
    setBusy(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanShopifyPage,
      });
      const payload = results?.[0]?.result;
      if (!payload) throw new Error('Could not scan this page');
      const report: StoreReport = {
        id: crypto.randomUUID(),
        storeLabel: payload.storeLabel,
        url: payload.url,
        checkedAt: Date.now(),
        checks: payload.checks,
        score: scoreChecks(payload.checks),
      };
      await saveReport(report);
      setCurrent(report);
      await refresh();
      flash('Scan complete');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setBusy(false);
    }
  };

  const copyReport = async (report: StoreReport) => {
    await navigator.clipboard.writeText(formatClientReport(report));
    flash('Client report copied');
  };

  const view = current ?? reports[0] ?? null;

  return (
    <div className="flex min-h-[520px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.45rem] font-extrabold">StorePulse</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Agency Shopify health checks — pixels, images, policies, publish cues.
        </p>
      </header>

      <div className="flex gap-2">
        <button type="button" className="btn flex-1 rounded-xl py-2.5 text-[13px]" disabled={busy} onClick={() => void runScan()}>
          {busy ? 'Scanning…' : 'Scan this tab'}
        </button>
        <button
          type="button"
          className="btn-ghost rounded-xl px-3 text-[12px]"
          onClick={async () => {
            await clearReports();
            setCurrent(null);
            await refresh();
            flash('History cleared');
          }}
        >
          Clear
        </button>
      </div>

      {view ? (
        <section className="panel flex min-h-0 flex-1 flex-col rounded-2xl p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">{view.storeLabel}</p>
              <p className="truncate text-[11px] text-[var(--soft)]">{view.url}</p>
            </div>
            <div className="rounded-xl bg-[var(--ink)] px-2.5 py-1 text-[13px] font-bold text-[var(--accent)]">
              {view.score}
            </div>
          </div>
          <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
            {view.checks.map((c) => (
              <li key={c.id} className="rounded-xl border border-[var(--line)] bg-white/60 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold">{c.label}</span>
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{
                      color:
                        c.severity === 'fail'
                          ? 'var(--fail)'
                          : c.severity === 'warn'
                            ? 'var(--warn)'
                            : c.severity === 'pass'
                              ? 'var(--pass)'
                              : 'var(--soft)',
                    }}
                  >
                    {c.severity}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--soft)]">{c.detail}</p>
              </li>
            ))}
          </ul>
          <button type="button" className="btn mt-3 rounded-xl py-2 text-[12px]" onClick={() => void copyReport(view)}>
            Copy client report
          </button>
        </section>
      ) : (
        <section className="panel flex flex-1 items-center justify-center rounded-2xl p-6 text-center text-[12px] text-[var(--soft)]">
          Open a Shopify admin or storefront tab, then scan.
        </section>
      )}

      {reports.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {reports.slice(0, 8).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setCurrent(r)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${
                view?.id === r.id ? 'bg-[var(--ink)] text-[var(--accent)]' : 'btn-ghost'
              }`}
            >
              {r.storeLabel.slice(0, 18)} · {r.score}
            </button>
          ))}
        </div>
      ) : null}

      {status ? (
        <div className="fixed right-3 bottom-3 left-3 rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-[var(--accent)]">
          {status}
        </div>
      ) : null}
    </div>
  );
}
