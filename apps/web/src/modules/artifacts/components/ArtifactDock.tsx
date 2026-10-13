import type { Deliverable } from '../types';
import './ArtifactDock.css';

export function ArtifactDock({ deliverable }: { deliverable: Deliverable | null }) {
  return (
    <section className="artifact-dock" aria-label="Deliverable">
      <h2>Artifact</h2>
      {!deliverable ? (
        <p className="artifact-dock__waiting">Waiting for deliverable</p>
      ) : (
        <div className="artifact-dock__card artifact-dock__card--landed">
          <div className="artifact-dock__kind">{deliverable.kind}</div>
          <div className="artifact-dock__title">{deliverable.title}</div>
          {deliverable.branch && <div className="artifact-dock__detail">{deliverable.branch}</div>}
          {deliverable.url && (
            <a className="artifact-dock__link" href={deliverable.url} target="_blank" rel="noreferrer">
              Open
            </a>
          )}
        </div>
      )}
    </section>
  );
}
