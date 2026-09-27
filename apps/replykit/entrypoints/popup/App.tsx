import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  deleteSnippet,
  listSnippets,
  normalizeShortcut,
  recordUsage,
  upsertSnippet,
} from '@/lib/storage';
import { insertIntoActiveTab } from '@/lib/messaging';
import type { Snippet, SnippetNiche } from '@/lib/types';

type View = 'list' | 'edit';

const NICHES: { id: SnippetNiche | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upwork', label: 'Upwork' },
  { id: 'email', label: 'Email' },
  { id: 'support', label: 'Support' },
  { id: 'general', label: 'General' },
];

const emptyDraft = (): Omit<Snippet, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> & {
  id?: string;
} => ({
  title: '',
  shortcut: ';',
  body: '',
  niche: 'upwork',
  tags: [],
});

export default function App() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [query, setQuery] = useState('');
  const [niche, setNiche] = useState<SnippetNiche | 'all'>('all');
  const [view, setView] = useState<View>('list');
  const [draft, setDraft] = useState(emptyDraft());
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      const rows = await listSnippets();
      setSnippets(rows);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snippets.filter((s) => {
      if (niche !== 'all' && s.niche !== niche) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.shortcut.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [snippets, query, niche]);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2200);
  };

  const openCreate = () => {
    setDraft(emptyDraft());
    setView('edit');
  };

  const openEdit = (snippet: Snippet) => {
    setDraft({
      id: snippet.id,
      title: snippet.title,
      shortcut: snippet.shortcut,
      body: snippet.body,
      niche: snippet.niche,
      tags: snippet.tags,
    });
    setView('edit');
  };

  const saveDraft = async () => {
    if (!draft.title.trim() || !draft.body.trim()) {
      flash('Title and body are required');
      return;
    }
    await upsertSnippet({
      ...draft,
      title: draft.title.trim(),
      shortcut: normalizeShortcut(draft.shortcut),
      body: draft.body.trim(),
      tags: draft.tags,
    });
    setView('list');
    refresh();
    flash(draft.id ? 'Snippet updated' : 'Snippet saved');
  };

  const remove = async (id: string) => {
    await deleteSnippet(id);
    refresh();
    flash('Snippet deleted');
  };

  const insert = async (snippet: Snippet) => {
    const result = await insertIntoActiveTab(snippet.body);
    if (result.ok) {
      await recordUsage(snippet.id);
      refresh();
      flash('Inserted into page');
    } else {
      flash(result.reason ?? 'Insert failed');
    }
  };

  return (
    <div className="flex min-h-[520px] flex-col p-3">
      <header className="panel rise-in mb-3 rounded-2xl px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="brand text-[1.55rem] leading-none font-extrabold text-[var(--ink)]">
              ReplyKit
            </p>
            <p className="mt-1 text-[12px] leading-snug text-[var(--ink-soft)]">
              Proposal macros for freelancers. Type a shortcut or insert in one click.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost rounded-xl px-2.5 py-1.5 text-[11px]"
            onClick={() => browser.runtime.openOptionsPage()}
          >
            Settings
          </button>
        </div>
      </header>

      {view === 'list' ? (
        <section className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="panel rise-in flex items-center gap-2 rounded-xl px-2.5 py-2">
            <input
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--ink-soft)]"
              placeholder="Search snippets…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className="btn-primary rounded-lg px-3 py-1.5 text-[12px]" onClick={openCreate}>
              New
            </button>
          </div>

          <div className="rise-in flex flex-wrap gap-1.5">
            {NICHES.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setNiche(n.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  niche === n.id
                    ? 'bg-[var(--ink)] text-[var(--accent)]'
                    : 'btn-ghost'
                }`}
              >
                {n.label}
              </button>
            ))}
          </div>

          <div className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl">
            {pending && filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-[var(--ink-soft)]">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-[var(--ink-soft)]">
                No snippets yet. Create one or reset starters in Settings.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {filtered.map((s, i) => (
                  <li
                    key={s.id}
                    className="snippet-row rise-in px-3 py-2.5"
                    style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => void insert(s)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold">{s.title}</span>
                          {s.shortcut ? (
                            <code className="shrink-0 rounded-md bg-[var(--mist)] px-1.5 py-0.5 text-[10px] text-[var(--ink-soft)]">
                              {s.shortcut}
                            </code>
                          ) : null}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--ink-soft)]">
                          {s.body}
                        </p>
                      </button>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          type="button"
                          className="btn-ghost rounded-lg px-2 py-1 text-[10px]"
                          onClick={() => openEdit(s)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-[10px] text-[var(--danger)]"
                          onClick={() => void remove(s.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-center text-[10px] text-[var(--ink-soft)]">
            Tip: type a shortcut like <code>;intro</code> then Space in any text field.
          </p>
        </section>
      ) : (
        <section className="panel rise-in flex min-h-0 flex-1 flex-col gap-2 rounded-2xl p-3">
          <div className="flex items-center justify-between">
            <h2 className="brand text-[1.05rem] font-bold">
              {draft.id ? 'Edit snippet' : 'New snippet'}
            </h2>
            <button type="button" className="btn-ghost rounded-lg px-2 py-1 text-[11px]" onClick={() => setView('list')}>
              Back
            </button>
          </div>

          <label className="block text-[11px] font-medium text-[var(--ink-soft)]">
            Title
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[13px] outline-none"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Cold intro"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] font-medium text-[var(--ink-soft)]">
              Shortcut
              <input
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[13px] outline-none"
                value={draft.shortcut}
                onChange={(e) => setDraft((d) => ({ ...d, shortcut: e.target.value }))}
                placeholder=";intro"
              />
            </label>
            <label className="block text-[11px] font-medium text-[var(--ink-soft)]">
              Niche
              <select
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[13px] outline-none"
                value={draft.niche}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, niche: e.target.value as SnippetNiche }))
                }
              >
                <option value="upwork">Upwork</option>
                <option value="email">Email</option>
                <option value="support">Support</option>
                <option value="general">General</option>
              </select>
            </label>
          </div>

          <label className="flex min-h-0 flex-1 flex-col text-[11px] font-medium text-[var(--ink-soft)]">
            Body
            <textarea
              className="mt-1 min-h-[180px] flex-1 resize-none rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] leading-relaxed outline-none"
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder="Hi {{client_name}}, …"
            />
          </label>

          <label className="block text-[11px] font-medium text-[var(--ink-soft)]">
            Tags (comma separated)
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[13px] outline-none"
              value={draft.tags.join(', ')}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  tags: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                }))
              }
              placeholder="proposal, opener"
            />
          </label>

          <button type="button" className="btn-primary rounded-xl py-2.5 text-[13px]" onClick={() => void saveDraft()}>
            Save snippet
          </button>
        </section>
      )}

      {status ? (
        <div className="rise-in fixed right-3 bottom-3 left-3 rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-[var(--accent)] shadow-lg">
          {status}
        </div>
      ) : null}
    </div>
  );
}
