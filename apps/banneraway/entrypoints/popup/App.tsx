import { useEffect, useState } from 'react';
import { loadState, saveSettings } from '@/lib/storage';
import type { BannerAwaySettings } from '@/lib/types';

export default function App() {
  const [settings, setSettings] = useState<BannerAwaySettings | null>(null);

  useEffect(() => {
    void loadState().then((s) => setSettings(s.settings));
  }, []);

  if (!settings) return <div className="p-4 text-[12px] text-[var(--soft)]">Loading…</div>;

  const persist = async (next: BannerAwaySettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  return (
    <div className="flex min-h-[360px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">BannerAway</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Hide common cookie/consent overlays and click Reject when a clear button exists.
        </p>
      </header>
      <section className="panel divide-y divide-[var(--line)] rounded-2xl">
        {(
          [
            ['enabled', 'Enabled', 'Hide known consent banners on pages you visit'],
            ['clickReject', 'Click Reject', 'Auto-click Reject / Necessary-only when found'],
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
      <p className="px-1 text-[10px] text-[var(--soft)]">
        Local only. Selector list is best-effort — sites change CMPs often.
      </p>
    </div>
  );
}
