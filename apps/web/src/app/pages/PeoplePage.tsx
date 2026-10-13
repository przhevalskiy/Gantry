import { useEffect, useState } from 'react';
import { catalogToGhostSeats, loadOperatorCatalog, OperatorPortrait, type OperatorSeat } from '@/modules/operators';
import './ListPages.css';

export function PeoplePage() {
  const [seats, setSeats] = useState<OperatorSeat[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadOperatorCatalog()
      .then(({ agents }) => {
        const ghost = catalogToGhostSeats(agents);
        // Promote to idle for handbook; prepend Foreman if missing
        const hasForeman = ghost.some(s => s.roleId.toLowerCase().includes('foreman'));
        const handbook: OperatorSeat[] = [
          ...(hasForeman
            ? []
            : [
                {
                  roleId: 'foreman',
                  title: 'Foreman',
                  description: 'Managing partner — conversational anchor for the firm',
                  presence: 'idle' as const,
                },
              ]),
          ...ghost.map(s => ({ ...s, presence: 'idle' as const })),
        ];
        setSeats(handbook);
      })
      .catch(e => setError((e as Error).message));
  }, []);

  return (
    <div className="list-page">
      <header>
        <h1>People</h1>
        <p>Operator handbook — specialists on staff at the firm.</p>
      </header>
      {error && <p className="list-page__error">{error}</p>}
      <div className="people-grid">
        {seats.map(seat => (
          <div key={seat.roleId} className="people-card">
            <OperatorPortrait seat={seat} size="md" />
            {seat.description && <p>{seat.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
