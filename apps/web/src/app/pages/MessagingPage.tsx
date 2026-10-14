import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { useAuthStore } from '@/modules/kernel';
import { fileJob, FirmChat, JobComposer, useEngagementStore } from '@/modules/engagement';
import { listMatters, type MatterSummary } from '@/modules/matters';
import { listWorkspaces, type GantryWorkspace } from '@/modules/workspaces';
import { EngagementFloor, OperatorPortrait, buildFloorSeats } from '@/modules/operators';
import { ArtifactDock } from '@/modules/artifacts';
import { listPractices, type Practice } from '@/modules/practices';
import { listBriefs, type Brief } from '@/modules/briefs';
import './MessagingPage.css';

type Sheet = 'none' | 'floor' | 'goals' | 'menu';

type Thread = {
  id: string;
  kind: 'firm' | 'matter';
  title: string;
  preview?: string;
  status?: string;
};

export function MessagingPage() {
  const { jobId } = useParams<{ jobId?: string }>();
  const navigate = useNavigate();
  const signOut = useAuthStore(s => s.signOut);

  const [matters, setMatters] = useState<MatterSummary[]>([]);
  const [workspaces, setWorkspaces] = useState<GantryWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [practices, setPractices] = useState<Practice[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [sheet, setSheet] = useState<Sheet>('none');
  const [error, setError] = useState<string | null>(null);
  const [filing, setFiling] = useState(false);
  const [mobileThreadsOpen, setMobileThreadsOpen] = useState(!jobId);

  const {
    open,
    reset,
    events,
    seats,
    hitl,
    deliverable,
    foremanSnippet,
    streaming,
    error: streamError,
    sendSteer,
    clearHitl,
    task,
  } = useEngagementStore();

  const refreshMatters = useCallback(() => {
    void listMatters(40)
      .then(setMatters)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void listWorkspaces()
      .then(ws => {
        setWorkspaces(ws);
        if (ws[0]) setWorkspaceId(ws[0].id);
      })
      .catch(e => setError((e as Error).message));
    refreshMatters();
    void listPractices()
      .then(setPractices)
      .catch(() => undefined);
    void listBriefs()
      .then(setBriefs)
      .catch(() => undefined);
  }, [refreshMatters]);

  useEffect(() => {
    if (!jobId) {
      reset();
      setMobileThreadsOpen(true);
      return;
    }
    setMobileThreadsOpen(false);
    void open(jobId);
    return () => reset();
  }, [jobId, open, reset]);

  const threads: Thread[] = useMemo(() => {
    const firm: Thread = {
      id: 'firm',
      kind: 'firm',
      title: 'Gantry',
      preview: 'File a job with the firm',
      status: 'ready',
    };
    const matterThreads = matters.map(m => ({
      id: m.id,
      kind: 'matter' as const,
      title: (m.goal || m.id).slice(0, 42),
      preview: m.status,
      status: m.status,
    }));
    return [firm, ...matterThreads];
  }, [matters]);

  const activeThreadId = jobId ?? 'firm';
  const isFirm = !jobId;
  const ghostFloor = buildFloorSeats({ snippet: 'ready' });

  const onFile = async (goal: string) => {
    setError(null);
    if (!workspaceId) {
      setError('Add a workspace from the menu first.');
      setSheet('menu');
      return;
    }
    setFiling(true);
    try {
      const res = await fileJob({
        type: 'file',
        goal,
        workspaceId,
        tier: 5,
      });
      refreshMatters();
      navigate(`/c/${res.task_id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFiling(false);
    }
  };

  const selectThread = (t: Thread) => {
    if (t.kind === 'firm') navigate('/');
    else navigate(`/c/${t.id}`);
    setSheet('none');
  };

  return (
    <div className="muse-msg">
      {/* Thread list — iMessage conversations */}
      <aside
        className={`muse-msg__threads${mobileThreadsOpen ? ' is-open' : ''}`}
        aria-label="Conversations"
      >
        <header className="muse-msg__threads-head">
          <div className="muse-msg__brand-lockup">
            <img src={logo} alt="" />
            <span>Gantry</span>
          </div>
          <button type="button" className="muse-msg__icon-btn" onClick={() => setSheet('menu')} aria-label="Menu">
            ···
          </button>
        </header>
        <ul className="muse-msg__thread-list">
          {threads.map(t => (
            <li key={t.id}>
              <button
                type="button"
                className={`muse-msg__thread${activeThreadId === t.id ? ' is-active' : ''}`}
                onClick={() => selectThread(t)}
              >
                <span className="muse-msg__thread-avatar" data-kind={t.kind}>
                  {t.kind === 'firm' ? '◆' : '▣'}
                </span>
                <span className="muse-msg__thread-body">
                  <span className="muse-msg__thread-title">{t.title}</span>
                  <span className="muse-msg__thread-preview">{t.preview}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Conversation — messaging surface */}
      <section className="muse-msg__chat" aria-label="Conversation">
        <header className="muse-msg__presence">
          <button
            type="button"
            className="muse-msg__back"
            onClick={() => setMobileThreadsOpen(true)}
            aria-label="Conversations"
          >
            ‹
          </button>
          <button type="button" className="muse-msg__presence-main" onClick={() => setSheet('floor')}>
            <OperatorPortrait
              seat={{
                roleId: 'foreman',
                title: 'Foreman',
                presence: hitl ? 'blocked' : streaming ? 'active' : 'idle',
                snippet: isFirm ? 'ready' : foremanSnippet,
              }}
              size="md"
              showLabel={false}
            />
            <div className="muse-msg__presence-copy">
              <strong>{isFirm ? 'Gantry' : 'Engagement'}</strong>
              <span>{isFirm ? 'Tell the firm what to ship' : foremanSnippet || task?.status || '…'}</span>
            </div>
          </button>
          <div className="muse-msg__presence-actions">
            <button type="button" onClick={() => setSheet('goals')} aria-label="Goals">
              Goals
            </button>
            <button type="button" onClick={() => setSheet('floor')} aria-label="Floor">
              Floor
            </button>
          </div>
        </header>

        <div className="muse-msg__stream">
          {isFirm ? (
            <div className="muse-msg__empty">
              <p className="muse-msg__empty-brand">Gantry</p>
              <p className="muse-msg__empty-line">the silicon firm</p>
              <p className="muse-msg__empty-hint">
                Message the firm to file a job. Operators take the floor; you leave with an artifact.
              </p>
              {(error || streamError) && <p className="muse-msg__error">{error || streamError}</p>}
            </div>
          ) : (
            <>
              {(error || streamError) && <p className="muse-msg__error muse-msg__error--inline">{error || streamError}</p>}
              <FirmChat
                events={events}
                hitl={hitl}
                deliverable={deliverable}
                onHitlResolved={() => clearHitl()}
              />
            </>
          )}
        </div>

        <div className="muse-msg__composer-wrap">
          {isFirm && workspaces.length > 0 && (
            <div className="muse-msg__workspace-pill">
              <select value={workspaceId} onChange={e => setWorkspaceId(e.target.value)} aria-label="Workspace">
                {workspaces.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <JobComposer
            placeholder={isFirm ? 'Message the firm…' : 'Amend / steer…'}
            cta={isFirm ? 'Send' : 'Send'}
            disabled={filing || (!isFirm && !jobId)}
            onSubmit={async value => {
              if (isFirm) await onFile(value);
              else await sendSteer(value);
            }}
          />
        </div>
      </section>

      {/* Sheets — not tabs */}
      {sheet !== 'none' && (
        <div className="muse-sheet" role="dialog" aria-modal="true">
          <button type="button" className="muse-sheet__scrim" aria-label="Close" onClick={() => setSheet('none')} />
          <div className="muse-sheet__panel">
            <header className="muse-sheet__head">
              <h2>
                {sheet === 'floor' && 'Floor'}
                {sheet === 'goals' && 'Goals'}
                {sheet === 'menu' && 'Firm'}
              </h2>
              <button type="button" onClick={() => setSheet('none')}>
                Done
              </button>
            </header>

            {sheet === 'floor' && (
              <div className="muse-sheet__body muse-sheet__body--floor">
                <EngagementFloor
                  seats={isFirm ? ghostFloor.map(s => ({ ...s, presence: s.roleId === 'foreman' ? 'idle' : 'ghost' })) : seats}
                  foremanSnippet={isFirm ? 'ready' : foremanSnippet}
                />
                {!isFirm && <ArtifactDock deliverable={deliverable} />}
              </div>
            )}

            {sheet === 'goals' && (
              <div className="muse-sheet__body">
                <p className="muse-sheet__lead">Matters the firm is tracking — open one as a side chat.</p>
                <ul className="muse-sheet__list">
                  {matters.length === 0 && <li className="muse-sheet__empty">No active matters yet.</li>}
                  {matters.map(m => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/c/${m.id}`);
                          setSheet('none');
                        }}
                      >
                        <strong>{(m.goal || m.id).slice(0, 64)}</strong>
                        <span>{m.status}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sheet === 'menu' && (
              <div className="muse-sheet__body">
                <section className="muse-sheet__section">
                  <h3>Practices</h3>
                  <ul className="muse-sheet__list">
                    {practices.length === 0 && <li className="muse-sheet__empty">None loaded</li>}
                    {practices.slice(0, 6).map(p => (
                      <li key={p.id}>
                        <div className="muse-sheet__static">
                          <strong>{p.name || p.id}</strong>
                          <span>{p.enabled === false ? 'disabled' : 'on retainer'}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="muse-sheet__section">
                  <h3>Briefs</h3>
                  <ul className="muse-sheet__list">
                    {briefs.length === 0 && <li className="muse-sheet__empty">None loaded</li>}
                    {briefs.slice(0, 6).map(b => (
                      <li key={b.id}>
                        <div className="muse-sheet__static">
                          <strong>{b.name || b.slug || b.id}</strong>
                          <span>{b.pack || 'playbook'}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="muse-sheet__section">
                  <h3>Workspaces</h3>
                  {workspaces.length === 0 ? (
                    <p className="muse-sheet__empty">Create via API — needed to file jobs.</p>
                  ) : (
                    <ul className="muse-sheet__list">
                      {workspaces.map(w => (
                        <li key={w.id}>
                          <button type="button" onClick={() => setWorkspaceId(w.id)}>
                            <strong>{w.name}</strong>
                            <span>{w.id === workspaceId ? 'selected' : w.github_url || w.id.slice(0, 8)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <button type="button" className="muse-sheet__signout" onClick={() => void signOut()}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
