import { useEffect, useState } from 'react';
import {
  exportState,
  getSettings,
  importState,
  resetWithStarters,
  updateSettings,
} from '@/lib/storage';
import type { ReplyKitSettings } from '@/lib/types';

export default function OptionsApp() {
  const [settings, setSettings] = useState<ReplyKitSettings | null>(null);
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  const flash = (msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(null), 2500);
  };

  if (!settings) {
    return <p className="p-8 text-sm text-[var(--ink-soft)]">Loading settings…</p>;
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-8">
        <h1 className="brand text-4xl font-extrabold">ReplyKit</h1>
        <p className="mt-2 max-w-lg text-sm text-[var(--ink-soft)]">
          Local-first snippet vault. Pro sync (Lemon Squeezy + cloud backup) slots in
          here without changing the popup.
        </p>
      </header>

      <section className="panel mb-4 rounded-2xl p-5">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Behavior</h2>
        <label className="mt-4 flex items-center justify-between gap-4 text-sm">
          <span>Expand shortcuts while typing (Space / Enter / Tab)</span>
          <input
            type="checkbox"
            checked={settings.expandShortcuts}
            onChange={(e) => {
              void updateSettings({ expandShortcuts: e.target.checked }).then(setSettings);
            }}
          />
        </label>
      </section>

      <section className="panel mb-4 rounded-2xl p-5">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Backup</h2>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Export JSON to move machines. Import replaces your current library.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary rounded-xl px-4 py-2 text-sm"
            onClick={async () => {
              const json = await exportState();
              await navigator.clipboard.writeText(json);
              flash('Export copied to clipboard');
            }}
          >
            Copy export JSON
          </button>
          <button
            type="button"
            className="btn-ghost rounded-xl px-4 py-2 text-sm"
            onClick={async () => {
              await resetWithStarters();
              flash('Reset to Upwork starter pack');
            }}
          >
            Reset starter pack
          </button>
        </div>
        <textarea
          className="mt-4 h-40 w-full rounded-xl border border-[var(--line)] bg-white/70 p-3 font-mono text-xs outline-none"
          placeholder="Paste ReplyKit JSON to import…"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary mt-2 rounded-xl px-4 py-2 text-sm"
          onClick={async () => {
            try {
              await importState(importText);
              flash('Import successful');
              setImportText('');
            } catch (err) {
              flash(err instanceof Error ? err.message : 'Import failed');
            }
          }}
        >
          Import JSON
        </button>
      </section>

      <section className="panel rounded-2xl p-5">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Pro (roadmap)</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--ink-soft)]">
          <li>Device sync via Supabase / your API</li>
          <li>Team shared libraries</li>
          <li>Lemon Squeezy license unlock (~$5–12/mo)</li>
        </ul>
        <p className="mt-3 text-xs text-[var(--ink-soft)]">
          Status: {settings.pro.enabled ? 'Pro active' : 'Free / local-only'}
        </p>
      </section>

      {message ? (
        <div className="fixed right-5 bottom-5 rounded-xl bg-[var(--ink)] px-4 py-2 text-sm text-[var(--accent)]">
          {message}
        </div>
      ) : null}
    </main>
  );
}
