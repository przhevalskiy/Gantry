import { useEffect, useState } from 'react';
import { clampBoost, clampSpeed, clampVolume, loadState, saveSettings } from '@/lib/storage';
import type { MediaBoostSettings } from '@/lib/types';

export default function App() {
  const [settings, setSettings] = useState<MediaBoostSettings | null>(null);

  useEffect(() => {
    void loadState().then((s) => setSettings(s.settings));
  }, []);

  if (!settings) return <div className="p-4 text-[12px] text-[var(--soft)]">Loading…</div>;

  const persist = async (next: MediaBoostSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  return (
    <div className="flex min-h-[420px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">MediaBoost</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          Speed and volume for HTML5 media. Boost uses Web Audio when the site allows it.
        </p>
      </header>

      <section className="panel space-y-3 rounded-2xl p-3">
        <label className="block text-[12px]">
          <span className="flex justify-between font-semibold">
            Speed <span>{settings.speed.toFixed(2)}×</span>
          </span>
          <input
            type="range"
            min={0.25}
            max={3}
            step={0.05}
            value={settings.speed}
            onChange={(e) => void persist({ ...settings, speed: clampSpeed(Number(e.target.value)) })}
          />
        </label>
        <label className="block text-[12px]">
          <span className="flex justify-between font-semibold">
            Volume <span>{Math.round(settings.volume * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.volume}
            onChange={(e) => void persist({ ...settings, volume: clampVolume(Number(e.target.value)) })}
          />
        </label>
        <label className="block text-[12px]">
          <span className="flex justify-between font-semibold">
            Boost <span>{settings.boost.toFixed(1)}×</span>
          </span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.1}
            value={settings.boost}
            onChange={(e) => void persist({ ...settings, boost: clampBoost(Number(e.target.value)) })}
          />
        </label>
        <button
          type="button"
          className="btn w-full rounded-xl py-2 text-[12px]"
          onClick={() => void persist({ ...settings, enabled: !settings.enabled })}
        >
          {settings.enabled ? 'Enabled — click to pause' : 'Paused — click to enable'}
        </button>
      </section>
      <p className="px-1 text-[10px] text-[var(--soft)]">
        Shortcuts: Alt+Shift+←/→ speed · Alt+Shift+↑ toggle boost. DRM sites may ignore boost.
      </p>
    </div>
  );
}
