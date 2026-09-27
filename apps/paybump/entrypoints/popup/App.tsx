import { useEffect, useMemo, useState } from 'react';
import { deleteMacro, listMacros, normalizeShortcut, recordUsage, upsertMacro } from '@/lib/storage';
import type { BumpMacro, BumpNiche } from '@/lib/types';

async function insertIntoActiveTab(body: string): Promise<{ ok: boolean; reason?: string }> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, reason: 'No active tab' };
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text: string) => {
        const el = document.activeElement;
        if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
          const start = el.selectionStart ?? el.value.length;
          const end = el.selectionEnd ?? el.value.length;
          el.value = el.value.slice(0, start) + text + el.value.slice(end);
          const caret = start + text.length;
          el.setSelectionRange(caret, caret);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return { ok: true as const };
        }
        if (el instanceof HTMLElement && el.isContentEditable) {
          document.execCommand('insertText', false, text);
          return { ok: true as const };
        }
        return { ok: false as const, reason: 'Focus a text field first' };
      },
      args: [body],
    });
    return results?.[0]?.result ?? { ok: false, reason: 'Insert failed' };
  } catch {
    return { ok: false, reason: 'Open a normal page and focus a field' };
  }
}

export default function App() {
  const [macros, setMacros] = useState<BumpMacro[]>([]);
  const [niche, setNiche] = useState<BumpNiche | 'all'>('all');
  const [status, setStatus] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', shortcut: ';', body: '', niche: 'stripe' as BumpNiche });

  const refresh = async () => setMacros(await listMacros());
  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(
    () => macros.filter((m) => niche === 'all' || m.niche === niche),
    [macros, niche],
  );

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="flex min-h-[520px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">PayBump</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Failed-payment & invoice macros for Stripe / indie SaaS dunning.
        </p>
      </header>

      <div className="flex flex-wrap gap-1">
        {(['all', 'stripe', 'invoice', 'general'] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNiche(n)}
            className={`rounded-full px-2.5 py-1 text-[11px] capitalize ${
              niche === n ? 'bg-[var(--ink)] text-[var(--accent)]' : 'btn-ghost'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <section className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl">
        <ul className="divide-y divide-[var(--line)]">
          {filtered.map((m) => (
            <li key={m.id} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={async () => {
                    const res = await insertIntoActiveTab(m.body);
                    if (res.ok) {
                      await recordUsage(m.id);
                      await refresh();
                      flash('Inserted');
                    } else flash(res.reason ?? 'Failed');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold">{m.title}</span>
                    <code className="rounded bg-black/5 px-1.5 py-0.5 text-[10px]">{m.shortcut}</code>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--soft)]">{m.body}</p>
                </button>
                <button
                  type="button"
                  className="text-[10px] text-red-600"
                  onClick={async () => {
                    await deleteMacro(m.id);
                    await refresh();
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel space-y-2 rounded-2xl p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--soft)]">New macro</p>
        <input
          className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
          placeholder="Title"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
            placeholder=";card"
            value={draft.shortcut}
            onChange={(e) => setDraft((d) => ({ ...d, shortcut: e.target.value }))}
          />
          <select
            className="rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px]"
            value={draft.niche}
            onChange={(e) => setDraft((d) => ({ ...d, niche: e.target.value as BumpNiche }))}
          >
            <option value="stripe">Stripe</option>
            <option value="invoice">Invoice</option>
            <option value="general">General</option>
          </select>
        </div>
        <textarea
          className="h-16 w-full resize-none rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[11px] outline-none"
          placeholder="Body with {{placeholders}}"
          value={draft.body}
          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
        />
        <button
          type="button"
          className="btn w-full rounded-xl py-2 text-[12px]"
          onClick={async () => {
            try {
              await upsertMacro({
                ...draft,
                shortcut: normalizeShortcut(draft.shortcut),
              });
              setDraft({ title: '', shortcut: ';', body: '', niche: 'stripe' });
              await refresh();
              flash('Macro saved');
            } catch (err) {
              flash(err instanceof Error ? err.message : 'Save failed');
            }
          }}
        >
          Save macro
        </button>
        <p className="text-[10px] text-[var(--soft)]">Type a shortcut like <code>;card</code> then Space in any field.</p>
      </section>

      {status ? (
        <div className="fixed right-3 bottom-3 left-3 rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-[var(--accent)]">
          {status}
        </div>
      ) : null}
    </div>
  );
}
