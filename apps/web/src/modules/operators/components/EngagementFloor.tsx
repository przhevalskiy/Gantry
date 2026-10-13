import type { OperatorSeat } from '../types';
import { OperatorPortrait } from './OperatorPortrait';
import './EngagementFloor.css';

export function EngagementFloor({
  seats,
  foremanSnippet,
  onSelect,
}: {
  seats: OperatorSeat[];
  foremanSnippet?: string;
  onSelect?: (seat: OperatorSeat) => void;
}) {
  const foreman = seats.find(s => s.roleId.toLowerCase().includes('foreman'));
  const crew = seats.filter(s => !s.roleId.toLowerCase().includes('foreman'));

  return (
    <aside className="eng-floor" aria-label="Engagement floor">
      <header className="eng-floor__header">
        <h2>Floor</h2>
        <p>Staffed for this engagement</p>
      </header>

      {foreman && (
        <div className="eng-floor__foreman">
          <OperatorPortrait
            seat={{
              ...foreman,
              snippet: foreman.snippet ?? foremanSnippet,
            }}
            size="lg"
            onSelect={onSelect}
          />
        </div>
      )}

      <div className="eng-floor__crew">
        {crew.map(seat => (
          <OperatorPortrait key={seat.roleId} seat={seat} size="sm" onSelect={onSelect} />
        ))}
      </div>
    </aside>
  );
}
