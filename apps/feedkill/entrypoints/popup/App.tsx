import { useEffect, useState } from 'react';
import { loadState, saveSettings } from '@/lib/storage';
import type { FeedKillSettings, SiteId } from '@/lib/types';

const ROWS: { id: SiteId | 'redirectShorts'; label: string; hint: string }[] = [
  { id: 'youtube', label: 'YouTube Shorts', hint: 'Hide shelves + redirect /shorts' },
  { id: 'instagram', label: 'Instagram Reels', hint: 'Hide Reels nav + /reels' },
  { id: 'x', label: 'X For You', hint: 'Prefer Following; hide For You tab' },
  { id: 'redirectShorts', label: 'Redirect Shorts URLs', hint: 'Open as normal YouTube watch' },
];

export default function App() {
  const [settings, setSettings] = useState<FeedKillSettings | null>(null);

  useEffect(() => {
    void loadState().then((s) => setSettings(s.settings));
  }, []);

  if (!settings) return <div className="p-4 text-[12px] text-[var(--soft)]">Loading…</div>;

  const toggle = async (key: keyof FeedKillSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    await saveSettings(next);
  };

  return (
    <div className="flex min-h-[420px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">FeedKill</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Kill infinite scroll traps. Search and subscriptions stay.
        </p>
      </header>
      <section className="panel divide-y divide-[var(--line)] rounded-2xl">
        {ROWS.map((row) => {
          const on = settings[row.id];
          return (
            <div key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">{row.label}</p>
                <p className="text-[10px] text-[var(--soft)]">{row.hint}</p>
              </div>
              <button
                type="button"
                className={`toggle shrink-0 ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => void toggle(row.id)}
              />
            </div>
          );
        })}
      </section>
      <p className="px-1 text-[10px] text-[var(--soft)]">
        Reload the tab after toggling if the feed was already open.
      </p>
    </div>
  );
}
