import { useEffect, useState } from 'react';
import { buildSummaryPrompt, extractPageText } from '@/lib/extract';
import { summarizeWithOpenAI } from '@/lib/openai';
import { loadState, saveSettings, saveState } from '@/lib/storage';
import type { PageSumSettings } from '@/lib/types';

export default function App() {
  const [settings, setSettings] = useState<PageSumSettings | null>(null);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    void loadState().then((s) => {
      setSettings(s.settings);
      if (s.lastSummary) setSummary(s.lastSummary.text);
    });
  }, []);

  const flash = (m: string) => {
    setStatus(m);
    window.setTimeout(() => setStatus(null), 2500);
  };

  if (!settings) {
    return <div className="p-4 text-[12px] text-[var(--soft)]">Loading…</div>;
  }

  const run = async () => {
    if (!settings.apiKey.trim()) {
      flash('Add your API key first');
      setShowKey(true);
      return;
    }
    setBusy(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageText,
      });
      const page = results?.[0]?.result;
      if (!page?.text || page.text.length < 40) throw new Error('Not enough text on this page');
      const prompt = buildSummaryPrompt(page.title, page.text);
      const text = await summarizeWithOpenAI({
        apiKey: settings.apiKey.trim(),
        baseUrl: settings.baseUrl.trim() || 'https://api.openai.com/v1',
        model: settings.model.trim() || 'gpt-4o-mini',
        prompt,
      });
      setSummary(text);
      const state = await loadState();
      state.lastSummary = { url: page.url, title: page.title, at: Date.now(), text };
      await saveState(state);
      flash('Summary ready');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Summarize failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[560px] flex-col gap-3 p-3">
      <header className="panel rounded-2xl px-3.5 py-3">
        <p className="brand text-[1.4rem] font-extrabold">PageSum</p>
        <p className="mt-1 text-[12px] text-[var(--soft)]">
          POC — summarize this page with your own API key (stored locally).
        </p>
      </header>

      <button type="button" className="btn rounded-xl py-2.5 text-[13px]" disabled={busy} onClick={() => void run()}>
        {busy ? 'Summarizing…' : 'Summarize this tab'}
      </button>

      <button type="button" className="btn-ghost rounded-xl px-3 py-2 text-[12px]" onClick={() => setShowKey((v) => !v)}>
        {showKey ? 'Hide settings' : 'API settings'}
      </button>

      {showKey ? (
        <section className="panel space-y-2 rounded-2xl p-3">
          <label className="block text-[11px] text-[var(--soft)]">
            API key
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              placeholder="sk-…"
            />
          </label>
          <label className="block text-[11px] text-[var(--soft)]">
            Base URL
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
              value={settings.baseUrl}
              onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
            />
          </label>
          <label className="block text-[11px] text-[var(--soft)]">
            Model
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[12px] outline-none"
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="btn w-full rounded-xl py-2 text-[12px]"
            onClick={async () => {
              await saveSettings(settings);
              flash('Settings saved locally');
            }}
          >
            Save settings
          </button>
        </section>
      ) : null}

      <section className="panel min-h-0 flex-1 overflow-y-auto rounded-2xl p-3">
        {summary ? (
          <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed">{summary}</pre>
        ) : (
          <p className="py-8 text-center text-[12px] text-[var(--soft)]">
            Add an API key, open an article, then summarize.
          </p>
        )}
      </section>

      {status ? (
        <div className="fixed right-3 bottom-3 left-3 rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-[12px] text-white">
          {status}
        </div>
      ) : null}
    </div>
  );
}
