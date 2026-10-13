import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fileJob, JobComposer } from '@/modules/engagement';
import { listMatters, type MatterSummary } from '@/modules/matters';
import { listWorkspaces, type GantryWorkspace } from '@/modules/workspaces';
import { buildFloorSeats, OperatorPortrait } from '@/modules/operators';
import './HomePage.css';

export function HomePage() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<GantryWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [matters, setMatters] = useState<MatterSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const floor = buildFloorSeats({ snippet: 'ready' });

  useEffect(() => {
    void listWorkspaces()
      .then(ws => {
        setWorkspaces(ws);
        if (ws[0]) setWorkspaceId(ws[0].id);
      })
      .catch(e => setError((e as Error).message));
    void listMatters(8)
      .then(setMatters)
      .catch(() => undefined);
  }, []);

  const onFile = async (goal: string) => {
    setError(null);
    if (!workspaceId) {
      setError('Create a workspace first.');
      return;
    }
    const res = await fileJob({
      type: 'file',
      goal,
      workspaceId,
      tier: 5,
    });
    navigate(`/jobs/${res.task_id}`);
  };

  return (
    <div className="home-page">
      <section className="home-hero">
        <p className="home-hero__brand">Gantry</p>
        <h1 className="home-hero__headline">the silicon firm</h1>
        <p className="home-hero__support">File a job. Watch the floor. Take the artifact.</p>

        <div className="home-hero__composer">
          {workspaces.length > 0 && (
            <label className="home-hero__workspace">
              <span>Workspace</span>
              <select value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}>
                {workspaces.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <JobComposer
            placeholder="Tell the firm what to ship…"
            cta="File"
            onSubmit={onFile}
            disabled={!workspaceId}
          />
          {error && <p className="home-hero__error">{error}</p>}
        </div>

        <div className="home-hero__floor" aria-label="Floor preview">
          <div className="home-hero__foreman">
            <OperatorPortrait
              seat={{
                roleId: 'foreman',
                title: 'Foreman',
                presence: 'idle',
                snippet: 'ready',
              }}
              size="lg"
            />
          </div>
          <div className="home-hero__ghosts">
            {floor
              .filter(s => s.roleId !== 'foreman')
              .map(seat => (
                <OperatorPortrait key={seat.roleId} seat={{ ...seat, presence: 'ghost' }} size="sm" />
              ))}
          </div>
        </div>

        {matters.length > 0 && (
          <div className="home-hero__matters">
            <span>Active matters</span>
            <ul>
              {matters.slice(0, 4).map(m => (
                <li key={m.id}>
                  <button type="button" onClick={() => navigate(`/jobs/${m.id}`)}>
                    {(m.goal || m.id).slice(0, 48)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
