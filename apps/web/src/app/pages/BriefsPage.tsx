import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listBriefs, runBrief, type Brief } from '@/modules/briefs';
import { listWorkspaces, type GantryWorkspace } from '@/modules/workspaces';
import './ListPages.css';

export function BriefsPage() {
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [workspaces, setWorkspaces] = useState<GantryWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void listBriefs()
      .then(setBriefs)
      .catch(e => setError((e as Error).message));
    void listWorkspaces()
      .then(ws => {
        setWorkspaces(ws);
        if (ws[0]) setWorkspaceId(ws[0].id);
      })
      .catch(() => undefined);
  }, []);

  const run = async (brief: Brief) => {
    if (!workspaceId) {
      setError('Select a workspace first.');
      return;
    }
    setBusy(brief.id);
    try {
      const res = await runBrief({
        goal: `Run brief: ${brief.name || brief.slug || brief.id}`,
        workspaceId,
        playbook: brief.slug || brief.id,
        pack: brief.pack,
        tier: 5,
      });
      navigate(`/jobs/${res.task_id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="list-page">
      <header>
        <h1>Briefs</h1>
        <p>Playbooks — engagement types the firm can staff.</p>
        {workspaces.length > 0 && (
          <label className="list-page__select">
            Workspace
            <select value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}>
              {workspaces.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {error && <p className="list-page__error">{error}</p>}
      <ul className="list-page__rows">
        {briefs.map(b => (
          <li key={b.id} className="list-page__card">
            <div>
              <span className="list-page__title">{b.name || b.slug || b.id}</span>
              <span className="list-page__meta">{b.pack ? `pack · ${b.pack}` : 'playbook'}</span>
              {b.description && <p className="list-page__desc">{b.description}</p>}
            </div>
            <div className="list-page__actions">
              <button type="button" disabled={busy === b.id || !workspaceId} onClick={() => void run(b)}>
                File
              </button>
            </div>
          </li>
        ))}
        {!error && briefs.length === 0 && <li className="list-page__empty">No briefs from /v1/playbooks.</li>}
      </ul>
    </div>
  );
}
