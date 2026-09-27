import { useEffect, useState } from 'react';
import { scanRefundPage, spikeScore } from '@/lib/scan';
import {
  clearScans,
  formatOpsNote,
  listScans,
  loadState,
  saveScan,
  setSpikeThreshold,
} from '@/lib/storage';
import type { RadarScan } from '@/lib/types';

export default function App() {
  const [scans, setScans] = useState<RadarScan[]>([]);
  const [current, setCurrent] = useState<RadarScan | null>(null);
  const [threshold, setThreshold] = useState(5);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setScans(await listScans());
    const state = await loadState();
    setThreshold(state.settings.spikeThreshold);
  };

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
        func: scanRefundPage,
        args: [threshold],
      });
      const payload = results?.[0]?.result;
      if (!payload) throw new Error('Could not scan this page');
      const scan: RadarScan = {
        id: crypto.randomUUID(),
        storeLabel: payload.storeLabel,
        url: payload.url,
        scannedAt: Date.now(),
        signals: payload.signals,
        spikeScore: spikeScore(payload.signals),
      };
      await saveScan(scan);
      setCurrent(scan);
      await refresh();
      flash(scan.spikeScore >= 55 ? 'Spike signals detected' : 'Scan complete');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setBusy(false);
    }
  };

  const view = current ?? scans[0] ?? null;

  return (
    <div className="flex min-h-[520px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.45rem] font-extrabold">RefundRadar</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Local Shopify admin scan for refund / return / cancel spikes.
        </p>
      </header>

      <div className="panel flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[12px]">
        <span className="text-[var(--soft)]">Spike threshold</span>
        <input
          type="number"
          min={1}
          max={50}
          className="w-16 rounded-lg border border-[var(--line)] bg-white/70 px-2 py-1 text-right outline-none"
          value={threshold}
          onChange={async (e) => {
            const n = Number(e.target.value) || 5;
            setThreshold(n);
            await setSpikeThreshold(n);
          }}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="btn flex-1 rounded-xl py-2.5 text-[13px]"
          disabled={busy}
          onClick={() => void runScan()}
        >
          {busy ? 'Scanning…' : 'Scan this tab'}
        </button>
        <button
          type="button"
          className="btn-ghost rounded-xl px-3 text-[12px]"
          onClick={async () => {
            await clearScans();
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
              {view.spikeScore}
            </div>
          </div>
          <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
            {view.signals.map((s) => (
              <li key={s.id} className="rounded-xl border border-[var(--line)] bg-white/60 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold">{s.label}</span>
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{
                      color:
                        s.severity === 'spike'
                          ? 'var(--fail)'
                          : s.severity === 'watch'
                            ? 'var(--warn)'
                            : s.severity === 'ok'
                              ? 'var(--pass)'
                              : 'var(--soft)',
                    }}
                  >
                    {s.severity}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--soft)]">{s.detail}</p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn mt-3 rounded-xl py-2 text-[12px]"
            onClick={async () => {
              await navigator.clipboard.writeText(formatOpsNote(view));
              flash('Ops note copied');
            }}
          >
            Copy ops note
          </button>
        </section>
      ) : (
        <section className="panel flex flex-1 items-center justify-center rounded-2xl p-6 text-center text-[12px] text-[var(--soft)]">
          Open Shopify admin Orders, then scan.
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
