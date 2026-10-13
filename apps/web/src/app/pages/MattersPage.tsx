import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMatters, type MatterSummary } from '@/modules/matters';
import './ListPages.css';

export function MattersPage() {
  const [matters, setMatters] = useState<MatterSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listMatters(50)
      .then(setMatters)
      .catch(e => setError((e as Error).message));
  }, []);

  return (
    <div className="list-page">
      <header>
        <h1>Matters</h1>
        <p>Durable jobs — open an engagement to talk to the firm.</p>
      </header>
      {error && <p className="list-page__error">{error}</p>}
      <ul className="list-page__rows">
        {matters.map(m => (
          <li key={m.id}>
            <Link to={`/jobs/${m.id}`}>
              <span className="list-page__title">{m.goal || m.id}</span>
              <span className="list-page__meta">
                {m.status}
                {m.playbook ? ` · ${m.playbook}` : ''}
                {m.hasArtifact ? ' · artifact' : ''}
              </span>
            </Link>
          </li>
        ))}
        {!error && matters.length === 0 && <li className="list-page__empty">No matters yet — file one from Home.</li>}
      </ul>
    </div>
  );
}
