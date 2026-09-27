import { useEffect, useState } from 'react';
import {
  addEvidence,
  checklistFromTemplate,
  deleteEvidence,
  exportEvidenceMarkdown,
  loadState,
  updateChecklist,
} from '@/lib/storage';
import type { EvidenceItem } from '@/lib/types';

export default function App() {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string; labels: string[] }[]>([]);
  const [templateId, setTemplateId] = useState('a11y');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [current, setCurrent] = useState<EvidenceItem | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const state = await loadState();
    setItems(state.items);
    setTemplates(state.templates);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2200);
  };

  const capture = async () => {
    setBusy(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId!, { format: 'png' });
      const tpl = templates.find((t) => t.id === templateId) ?? templates[0];
      const item = await addEvidence({
        title: title.trim() || tpl?.name || 'Evidence capture',
        url: tab.url || '',
        pageTitle: tab.title || '',
        note: note.trim(),
        screenshotDataUrl: dataUrl,
        checklist: checklistFromTemplate(tpl?.labels ?? ['Reviewed']),
      });
      setCurrent(item);
      setTitle('');
      setNote('');
      await refresh();
      flash('Evidence captured');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Capture failed');
    } finally {
      setBusy(false);
    }
  };

  const view = current ?? items[0] ?? null;

  return (
    <div className="flex min-h-[560px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">EvidenceKit</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Screenshot + timestamp + checklist for compliance proof packs.
        </p>
      </header>

      <section className="panel space-y-2 rounded-2xl p-3">
        <select
          className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px]"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
          placeholder="Evidence title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="h-14 w-full resize-none rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
          placeholder="Notes…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="button" className="btn w-full rounded-xl py-2.5 text-[13px]" disabled={busy} onClick={() => void capture()}>
          {busy ? 'Capturing…' : 'Capture this tab'}
        </button>
      </section>

      {view ? (
        <section className="panel flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{view.title}</p>
              <p className="truncate text-[10px] text-[var(--soft)]">
                {new Date(view.capturedAt).toLocaleString()} · {view.url}
              </p>
            </div>
            <button
              type="button"
              className="text-[10px] text-red-600"
              onClick={async () => {
                await deleteEvidence(view.id);
                setCurrent(null);
                await refresh();
              }}
            >
              Delete
            </button>
          </div>
          {view.screenshotDataUrl ? (
            <img src={view.screenshotDataUrl} alt="Evidence screenshot" className="max-h-28 w-full rounded-xl object-cover object-top" />
          ) : null}
          <ul className="space-y-1">
            {view.checklist.map((c, idx) => (
              <li key={c.id}>
                <label className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={c.done}
                    onChange={async (e) => {
                      const next = view.checklist.map((x, i) =>
                        i === idx ? { ...x, done: e.target.checked } : x,
                      );
                      await updateChecklist(view.id, next);
                      const updated = { ...view, checklist: next };
                      setCurrent(updated);
                      await refresh();
                    }}
                  />
                  {c.label}
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn rounded-xl py-2 text-[12px]"
            onClick={async () => {
              await navigator.clipboard.writeText(exportEvidenceMarkdown(view));
              flash('Evidence markdown copied');
            }}
          >
            Copy evidence pack
          </button>
        </section>
      ) : (
        <section className="panel flex flex-1 items-center justify-center rounded-2xl p-6 text-center text-[12px] text-[var(--soft)]">
          Capture a tab to start an evidence pack.
        </section>
      )}

      {items.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto">
          {items.slice(0, 8).map((i) => (
            <button
              key={i.id}
              type="button"
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${
                view?.id === i.id ? 'bg-[var(--ink)] text-[var(--accent)]' : 'btn-ghost'
              }`}
              onClick={() => setCurrent(i)}
            >
              {i.title.slice(0, 16)}
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
