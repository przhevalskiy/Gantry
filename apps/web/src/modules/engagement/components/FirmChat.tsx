import { useEffect, useRef } from 'react';
import { HitlCard } from '@/modules/hitl/components/HitlCard';
import { ArtifactCard } from '@/modules/artifacts/components/ArtifactCard';
import type { Deliverable } from '@/modules/artifacts';
import type { HitlCheckpoint } from '@/modules/hitl';
import type { EngagementEvent } from '../types';
import './FirmChat.css';

export function FirmChat({
  events,
  hitl,
  deliverable,
  onHitlResolved,
}: {
  events: EngagementEvent[];
  hitl: HitlCheckpoint | null;
  deliverable: Deliverable | null;
  onHitlResolved?: (approved: boolean) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length, hitl, deliverable]);

  return (
    <div className="firm-chat" aria-live="polite">
      {events.map(ev => {
        if (ev.kind === 'hitl' && hitl && ev.hitlCheckpoint === hitl.checkpoint) {
          return (
            <div key={ev.id} className="firm-chat__row firm-chat__row--hitl">
              <HitlCard checkpoint={hitl} onResolved={onHitlResolved} />
            </div>
          );
        }
        if (ev.kind === 'artifact' && deliverable) {
          return (
            <div key={ev.id} className="firm-chat__row firm-chat__row--artifact">
              <ArtifactCard deliverable={deliverable} />
            </div>
          );
        }
        if (ev.kind === 'hitl' || ev.kind === 'artifact') {
          // Seed without live payload yet — skip duplicate shell
          if (ev.kind === 'hitl' && !hitl) return null;
          if (ev.kind === 'artifact' && !deliverable) return null;
        }
        return (
          <div key={ev.id} className={`firm-chat__row firm-chat__row--${ev.kind}`}>
            {ev.kind !== 'user' && (
              <div className="firm-chat__who">
                {ev.kind === 'operator' && ev.operatorRoleId
                  ? ev.operatorRoleId
                  : ev.kind === 'lifecycle'
                    ? 'floor'
                    : ev.kind === 'system'
                      ? 'system'
                      : 'Foreman'}
              </div>
            )}
            <div className="firm-chat__bubble">{ev.body}</div>
          </div>
        );
      })}

      {hitl && !events.some(e => e.kind === 'hitl' && e.hitlCheckpoint === hitl.checkpoint) && (
        <div className="firm-chat__row firm-chat__row--hitl">
          <HitlCard checkpoint={hitl} onResolved={onHitlResolved} />
        </div>
      )}

      {deliverable && !events.some(e => e.kind === 'artifact') && (
        <div className="firm-chat__row firm-chat__row--artifact">
          <ArtifactCard deliverable={deliverable} />
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
