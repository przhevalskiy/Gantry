import type { Deliverable } from '../types';
import './ArtifactCard.css';

export function ArtifactCard({ deliverable }: { deliverable: Deliverable }) {
  return (
    <div className="artifact-card">
      <div className="artifact-card__eyebrow">Deliverable ready</div>
      <div className="artifact-card__title">{deliverable.title}</div>
      {deliverable.branch && <div className="artifact-card__detail">{deliverable.branch}</div>}
      {deliverable.url && (
        <a href={deliverable.url} target="_blank" rel="noreferrer">
          Open {deliverable.kind}
        </a>
      )}
    </div>
  );
}
