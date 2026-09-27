import { useEffect, useState } from 'react';
import { captureProductFields, diffFields } from '@/lib/capture';
import { clearAll, loadState, saveBaseline, saveCompare } from '@/lib/storage';
import type { FieldDiff, ProductSnapshot } from '@/lib/types';

export default function App() {
  const [baseline, setBaseline] = useState<ProductSnapshot | null>(null);
  const [diffs, setDiffs] = useState<FieldDiff[]>([]);
  const [compareMeta, setCompareMeta] = useState<{ productLabel: string; url: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const state = await loadState();
    setBaseline(state.baseline);
    if (state.lastCompare) {
      setDiffs(state.lastCompare.diffs);
      setCompareMeta({ productLabel: state.lastCompare.productLabel, url: state.lastCompare.url });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2200);
  };

  const runCapture = async () => {
    setBusy(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: captureProductFields,
      });
      const payload = results?.[0]?.result;
      if (!payload) throw new Error('Could not read fields on this page');
      const snapshot: ProductSnapshot = {
        id: crypto.randomUUID(),
        productLabel: payload.productLabel,
        url: payload.url,
        capturedAt: Date.now(),
        fields: payload.fields,
      };
      await saveBaseline(snapshot);
      setBaseline(snapshot);
      setDiffs([]);
      setCompareMeta(null);
      flash(`Baseline saved (${snapshot.fields.length} fields)`);
      await refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Capture failed');
    } finally {
      setBusy(false);
    }
  };

  const runCompare = async () => {
    setBusy(true);
    try {
      if (!baseline) throw new Error('Save a baseline first');
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: captureProductFields,
      });
      const payload = results?.[0]?.result;
      if (!payload) throw new Error('Could not read fields on this page');
      const next = diffFields(baseline.fields, payload.fields);
      await saveCompare({
        productLabel: payload.productLabel,
        url: payload.url,
        diffs: next,
      });
      setDiffs(next);
      setCompareMeta({ productLabel: payload.productLabel, url: payload.url });
      const changed = next.filter((d) => d.changed).length;
      flash(changed ? `${changed} field(s) changed` : 'No changes vs baseline');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Compare failed');
    } finally {
      setBusy(false);
    }
  };

  const changed = diffs.filter((d) => d.changed);

  return (
    <div className="flex min-h-[520px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.45rem] font-extrabold">VariantDiff</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Snapshot product/variant fields on Shopify admin, then diff before publish.
        </p>
      </header>

      <div className="flex gap-2">
        <button
          type="button"
          className="btn flex-1 rounded-xl py-2.5 text-[13px]"
          disabled={busy}
          onClick={() => void runCapture()}
        >
          {busy ? 'Working…' : 'Save baseline'}
        </button>
        <button
          type="button"
          className="btn flex-1 rounded-xl py-2.5 text-[13px]"
          disabled={busy || !baseline}
          onClick={() => void runCompare()}
        >
          Diff vs baseline
        </button>
      </div>

      {baseline ? (
        <div className="panel rounded-xl px-3 py-2 text-[11px] text-[var(--soft)]">
          Baseline: <span className="font-semibold text-[var(--ink)]">{baseline.productLabel}</span>
          {' · '}
          {baseline.fields.length} fields · {new Date(baseline.capturedAt).toLocaleString()}
        </div>
      ) : (
        <div className="panel rounded-xl px-3 py-2 text-[11px] text-[var(--soft)]">
          Open a Shopify product editor, then save a baseline.
        </div>
      )}

      <section className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl p-3">
        {diffs.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-[var(--soft)]">
            No compare yet. Edit fields, then Diff vs baseline.
          </p>
        ) : (
          <>
            <p className="mb-2 text-[11px] text-[var(--soft)]">
              {compareMeta?.productLabel} — {changed.length} changed / {diffs.length} fields
            </p>
            <ul className="space-y-2">
              {(changed.length ? changed : diffs.slice(0, 12)).map((d) => (
                <li
                  key={d.key}
                  className="rounded-xl border border-[var(--line)] bg-white/60 px-2.5 py-2"
                >
                  <p className="text-[12px] font-semibold">{d.label}</p>
                  <p className="mt-1 text-[10px] text-[var(--soft)]">Before: {d.before || '—'}</p>
                  <p className="text-[10px] text-[var(--ink)]">After: {d.after || '—'}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <button
        type="button"
        className="btn-ghost rounded-xl px-3 py-2 text-[12px]"
        onClick={async () => {
          await clearAll();
          setBaseline(null);
          setDiffs([]);
          setCompareMeta(null);
          flash('Cleared');
        }}
      >
        Clear baseline & diffs
      </button>

      {status ? (
        <div className="fixed right-3 bottom-3 left-3 rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-[var(--accent)]">
          {status}
        </div>
      ) : null}
    </div>
  );
}
