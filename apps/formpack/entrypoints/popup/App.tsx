import { useEffect, useState } from 'react';
import { fillFormFields } from '@/lib/fill';
import {
  deleteProfile,
  fieldsToText,
  listProfiles,
  upsertProfile,
} from '@/lib/storage';
import type { FormProfile, PackNiche } from '@/lib/types';

export default function App() {
  const [profiles, setProfiles] = useState<FormProfile[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    niche: 'shipping' as PackNiche,
    fieldsText: 'email=you@example.com\nname=Your Name',
  });

  const refresh = async () => setProfiles(await listProfiles());
  useEffect(() => {
    void refresh();
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2200);
  };

  const fill = async (profile: FormProfile) => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      flash('No active tab');
      return;
    }
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillFormFields,
        args: [profile.fields],
      });
      const res = results?.[0]?.result as { filled: number } | undefined;
      flash(res ? `Filled ${res.filled} fields` : 'Fill finished');
    } catch {
      flash('Open a normal form page first');
    }
  };

  return (
    <div className="flex min-h-[540px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">FormPack</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Niche autofill packs — shipping, grants, admin contacts.
        </p>
      </header>

      <section className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl">
        <ul className="divide-y divide-[var(--line)]">
          {profiles.map((p) => (
            <li key={p.id} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void fill(p)}>
                  <p className="text-[13px] font-semibold">{p.name}</p>
                  <p className="text-[10px] capitalize text-[var(--soft)]">
                    {p.niche} · {p.fields.length} fields
                  </p>
                </button>
                <button
                  type="button"
                  className="text-[10px] text-red-600"
                  onClick={async () => {
                    await deleteProfile(p.id);
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
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--soft)]">
          New profile (key=value per line)
        </p>
        <input
          className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
          placeholder="Profile name"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <select
          className="w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px]"
          value={draft.niche}
          onChange={(e) => setDraft((d) => ({ ...d, niche: e.target.value as PackNiche }))}
        >
          <option value="shipping">Shipping</option>
          <option value="grant">Grant</option>
          <option value="admin">Admin</option>
          <option value="custom">Custom</option>
        </select>
        <textarea
          className="h-24 w-full resize-none rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 font-mono text-[11px] outline-none"
          value={draft.fieldsText}
          onChange={(e) => setDraft((d) => ({ ...d, fieldsText: e.target.value }))}
        />
        <button
          type="button"
          className="btn w-full rounded-xl py-2 text-[12px]"
          onClick={async () => {
            try {
              await upsertProfile(draft);
              setDraft({ name: '', niche: 'shipping', fieldsText: fieldsToText([]) });
              await refresh();
              flash('Profile saved');
            } catch (err) {
              flash(err instanceof Error ? err.message : 'Save failed');
            }
          }}
        >
          Save profile
        </button>
      </section>

      {status ? (
        <div className="fixed right-3 bottom-3 left-3 rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-[var(--accent)]">
          {status}
        </div>
      ) : null}
    </div>
  );
}
