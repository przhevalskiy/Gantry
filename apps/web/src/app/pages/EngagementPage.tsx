import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EngagementFloor } from '@/modules/operators';
import { ArtifactDock } from '@/modules/artifacts';
import { FirmChat, JobComposer, useEngagementStore } from '@/modules/engagement';
import './EngagementPage.css';

export function EngagementPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const {
    open,
    reset,
    events,
    seats,
    hitl,
    deliverable,
    foremanSnippet,
    streaming,
    error,
    sendSteer,
    clearHitl,
    task,
  } = useEngagementStore();

  useEffect(() => {
    if (!jobId) return;
    void open(jobId);
    return () => reset();
  }, [jobId, open, reset]);

  return (
    <div className="engagement-page">
      <header className="engagement-page__bar">
        <Link to="/jobs">← Matters</Link>
        <div className="engagement-page__meta">
          <strong>{jobId?.slice(0, 10)}</strong>
          <span>{task?.status ?? (streaming ? 'streaming' : '—')}</span>
          <span>{foremanSnippet}</span>
        </div>
      </header>

      <div className="engagement-page__theater">
        <section className="engagement-page__thread">
          {error && <p className="engagement-page__error">{error}</p>}
          <FirmChat
            events={events}
            hitl={hitl}
            deliverable={deliverable}
            onHitlResolved={() => clearHitl()}
          />
          <JobComposer
            placeholder="Amend / steer the engagement…"
            onSubmit={prompt => sendSteer(prompt)}
            disabled={!jobId}
          />
        </section>

        <aside className="engagement-page__rail">
          <EngagementFloor seats={seats} foremanSnippet={foremanSnippet} />
          <ArtifactDock deliverable={deliverable} />
        </aside>
      </div>
    </div>
  );
}
