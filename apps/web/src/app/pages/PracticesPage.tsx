import { useEffect, useState } from 'react';
import { listPractices, retainPractice, setPracticeEnabled, type Practice } from '@/modules/practices';
import './ListPages.css';

export function PracticesPage() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () =>
    listPractices()
      .then(setPractices)
      .catch(e => setError((e as Error).message));

  useEffect(() => {
    void refresh();
  }, []);

  const retain = async (id: string) => {
    setBusy(id);
    try {
      await retainPractice(id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (id: string, enabled: boolean) => {
    setBusy(id);
    try {
      await setPracticeEnabled(id, enabled);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="list-page">
      <header>
        <h1>Practices</h1>
        <p>Firm packs on retainer — not a bot marketplace.</p>
      </header>
      {error && <p className="list-page__error">{error}</p>}
      <ul className="list-page__rows">
        {practices.map(p => (
          <li key={p.id} className="list-page__card">
            <div>
              <span className="list-page__title">{p.name || p.id}</span>
              <span className="list-page__meta">
                {p.version ? `v${p.version}` : ''}
                {p.enabled === true ? ' · enabled' : p.enabled === false ? ' · disabled' : ''}
              </span>
              {p.description && <p className="list-page__desc">{p.description}</p>}
            </div>
            <div className="list-page__actions">
              <button type="button" disabled={busy === p.id} onClick={() => void retain(p.id)}>
                Retain
              </button>
              {typeof p.enabled === 'boolean' && (
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => void toggle(p.id, !p.enabled)}
                >
                  {p.enabled ? 'Disable' : 'Enable'}
                </button>
              )}
            </div>
          </li>
        ))}
        {!error && practices.length === 0 && <li className="list-page__empty">No practices returned from /v1/packs.</li>}
      </ul>
    </div>
  );
}
