import type { OperatorPresence, OperatorSeat } from '../types';
import './OperatorPortrait.css';

const ROLE_MARK: Record<string, string> = {
  foreman: '◆',
  pm: '▭',
  architect: '◫',
  builder: '▣',
  inspector: '◎',
  reviewer: '◑',
  security: '⬡',
  devops: '▹',
  'oracle-a11y': '◐',
  oracle_a11y: '◐',
};

function markFor(roleId: string): string {
  const key = roleId.toLowerCase().replace(/\s+/g, '-');
  return ROLE_MARK[key] ?? ROLE_MARK[key.split('-')[0] ?? ''] ?? '●';
}

export function OperatorPortrait({
  seat,
  size = 'md',
  showLabel = true,
  onSelect,
}: {
  seat: OperatorSeat;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onSelect?: (seat: OperatorSeat) => void;
}) {
  const presence: OperatorPresence = seat.presence;
  const isForeman = seat.roleId.toLowerCase().includes('foreman');

  return (
    <button
      type="button"
      className={`op-portrait op-portrait--${size} op-portrait--${presence}${isForeman ? ' op-portrait--foreman' : ''}`}
      onClick={() => onSelect?.(seat)}
      aria-label={`${seat.title}, ${presence}`}
    >
      <span className="op-portrait__field" aria-hidden />
      <span className="op-portrait__bezel">
        <span className="op-portrait__bust" data-role={seat.roleId.toLowerCase()}>
          <span className="op-portrait__mark">{markFor(seat.roleId)}</span>
        </span>
      </span>
      {showLabel && (
        <span className="op-portrait__meta">
          <span className="op-portrait__title">
            {seat.title}
            {seat.parallelCount && seat.parallelCount > 1 ? ` ×${seat.parallelCount}` : ''}
          </span>
          {seat.snippet && <span className="op-portrait__snippet">{seat.snippet}</span>}
        </span>
      )}
    </button>
  );
}
