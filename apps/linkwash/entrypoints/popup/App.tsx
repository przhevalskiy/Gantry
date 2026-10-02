import { useEffect, useState } from 'react';
import { cleanUrl } from '@/lib/clean';
import { loadState, saveSettings, setLastCleaned } from '@/lib/storage';
import type { LinkWashSettings } from '@/lib/types';

export default function App() {
  const [settings, setSettings] = useState<LinkWashSettings | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void loadState().then((s) => {
      setSettings(s.settings);
      setLast(s.lastCleaned);
    });
  }, []);

  if (!settings) return <div className="p-4 text-[12px] text-[var(--soft)]">Loading…</div>;

  const persist = async (next: LinkWashSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  const cleanTab = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      setStatus('No tab URL');
      return;
    }
    const { cleaned, removed } = cleanUrl(tab.url, settings.aggressive);
    await navigator.clipboard.writeText(cleaned);
    await setLastCleaned(cleaned);
    setLast(cleaned);
    setStatus(removed.length ? `Copied · removed ${removed.length}` : 'Copied · already clean');
    window.setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="flex min-h-[400px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">LinkWash</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Clean tracking junk from copied URLs. Right-click any link → Copy clean link.
        </p>
      </header>
      <section className="panel divide-y divide-[var(--line)] rounded-2xl">
        {(
          [
            ['enabled', 'Auto-clean on copy', 'Rewrite clipboard when you copy a URL'],
            ['aggressive', 'Aggressive mode', 'Also strip ref/source/campaign-style params'],
          ] as const
        ).map(([key, label, hint]) => (
          <div key={key} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div>
              <p className="text-[13px] font-semibold">{label}</p>
              <p className="text-[10px] text-[var(--soft)]">{hint}</p>
            </div>
            <button
              type="button"
              className={`toggle ${settings[key] ? 'on' : ''}`}
              onClick={() => void persist({ ...settings, [key]: !settings[key] })}
            />
          </div>
        ))}
      </section>
      <button type="button" className="btn rounded-xl py-2.5 text-[13px]" onClick={() => void cleanTab()}>
        Clean & copy this tab URL
      </button>
      {last ? (
        <section className="panel rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-wide text-[var(--soft)]">Last cleaned</p>
          <p className="mt-1 break-all text-[11px]">{last}</p>
        </section>
      ) : null}
      {status ? (
        <div className="rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-[var(--accent)]">
          {status}
        </div>
      ) : null}
    </div>
  );
}
