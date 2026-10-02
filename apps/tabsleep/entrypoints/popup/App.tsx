import { useEffect, useState } from 'react';
import {
  addSession,
  clampIdleMinutes,
  deleteSession,
  loadState,
  saveSettings,
} from '@/lib/storage';
import type { SavedSession, TabSleepSettings } from '@/lib/types';

export default function App() {
  const [settings, setSettings] = useState<TabSleepSettings | null>(null);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const refresh = async () => {
    const s = await loadState();
    setSettings(s.settings);
    setSessions(s.sessions);
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (!settings) return <div className="p-4 text-[12px] text-[var(--soft)]">Loading…</div>;

  const persist = async (next: TabSleepSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  const flash = (m: string) => {
    setStatus(m);
    window.setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="flex min-h-[480px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">TabSleep</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Discard idle tabs to free memory. Save a window as a named session.
        </p>
      </header>

      <button
        type="button"
        className="btn rounded-xl py-2.5 text-[13px]"
        onClick={() => {
          void browser.runtime.sendMessage({ type: 'tabsleep:suspend-others' });
          flash('Suspended other tabs in this window');
        }}
      >
        Suspend other tabs now
      </button>

      <section className="panel space-y-2 rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold">Auto-suspend</p>
          <button
            type="button"
            className={`toggle ${settings.enabled ? 'on' : ''}`}
            onClick={() => void persist({ ...settings, enabled: !settings.enabled })}
          />
        </div>
        <label className="block text-[12px]">
          Idle minutes
          <input
            type="number"
            min={1}
            max={240}
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 outline-none"
            value={settings.idleMinutes}
            onChange={(e) =>
              void persist({ ...settings, idleMinutes: clampIdleMinutes(Number(e.target.value) || 1) })
            }
          />
        </label>
        {(
          [
            ['keepPinned', 'Keep pinned tabs awake'],
            ['keepAudible', 'Keep audible tabs awake'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <p className="text-[12px]">{label}</p>
            <button
              type="button"
              className={`toggle ${settings[key] ? 'on' : ''}`}
              onClick={() => void persist({ ...settings, [key]: !settings[key] })}
            />
          </div>
        ))}
      </section>

      <section className="panel space-y-2 rounded-2xl p-3">
        <p className="text-[13px] font-semibold">Sessions</p>
        <div className="flex gap-1.5">
          <input
            className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
            placeholder="Session name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="btn rounded-xl px-3 text-[12px]"
            onClick={() =>
              void (async () => {
                const tabs = await browser.tabs.query({ currentWindow: true });
                const urls = tabs.map((t) => t.url || '').filter((u) => u.startsWith('http'));
                await addSession(name, urls);
                setName('');
                await refresh();
                flash(`Saved ${urls.length} tabs`);
              })()
            }
          >
            Save
          </button>
        </div>
        <ul className="max-h-40 space-y-1.5 overflow-y-auto">
          {sessions.length === 0 ? (
            <li className="text-[11px] text-[var(--soft)]">No saved sessions yet.</li>
          ) : (
            sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold">{s.name}</p>
                  <p className="text-[10px] text-[var(--soft)]">{s.urls.length} tabs</p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="btn-ghost rounded-lg px-2 py-1 text-[10px]"
                    onClick={() =>
                      void (async () => {
                        for (const url of s.urls) {
                          await browser.tabs.create({ url, active: false });
                        }
                        flash('Restored session');
                      })()
                    }
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="text-[10px] text-red-700"
                    onClick={() => void deleteSession(s.id).then(refresh)}
                  >
                    Del
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {status ? (
        <div className="rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-[var(--accent)]">
          {status}
        </div>
      ) : null}
    </div>
  );
}
