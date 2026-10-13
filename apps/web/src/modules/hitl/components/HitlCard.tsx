import { useState } from 'react';
import type { HitlCheckpoint } from '../types';
import { submitHitlDecision } from '../api';
import './HitlCard.css';

export function HitlCard({
  checkpoint,
  onResolved,
}: {
  checkpoint: HitlCheckpoint;
  onResolved?: (approved: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (approved: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await submitHitlDecision(checkpoint, { approved });
      onResolved?.(approved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hitl-card" role="group" aria-label="Partner approval">
      <div className="hitl-card__eyebrow">Needs your sign-off</div>
      <h3 className="hitl-card__title">{checkpoint.description || checkpoint.checkpoint}</h3>
      <p className="hitl-card__meta">{checkpoint.checkpoint}</p>
      {error && <p className="hitl-card__error">{error}</p>}
      <div className="hitl-card__actions">
        <button type="button" className="hitl-card__approve" disabled={busy} onClick={() => void decide(true)}>
          Approve
        </button>
        <button type="button" className="hitl-card__reject" disabled={busy} onClick={() => void decide(false)}>
          Reject
        </button>
      </div>
    </div>
  );
}
