'use client';

import type { Episode } from './types';

export function ScoreTrend({ episodes }: { episodes: Episode[] }) {
  const scored = [...episodes]
    .filter(ep => ep.quality_score != null)
    .slice(0, 12)
    .reverse();

  if (scored.length < 2) return null;

  const avg = scored.reduce((s, ep) => s + (ep.quality_score ?? 0), 0) / scored.length;

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
        <p style={{
          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--text-secondary)', margin: 0,
        }}>
          Quality — {scored.length} build{scored.length !== 1 ? 's' : ''}
        </p>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
          avg {avg.toFixed(1)}/10
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36 }}>
        {scored.map((ep, i) => {
          const score = ep.quality_score ?? 5;
          const pct = (score / 10) * 100;
          const color = score >= 8 ? '#22c55e' : score >= 6 ? '#f59e0b' : '#ef4444';
          const goalSnippet = ep.goal?.slice(0, 80) ?? '';
          return (
            <div
              key={i}
              title={`Build ${i + 1}: ${score}/10${goalSnippet ? ` — ${goalSnippet}` : ''}`}
              style={{
                flex: 1, height: `${Math.max(pct, 8)}%`, minHeight: 3,
                background: color, borderRadius: '2px 2px 0 0', opacity: 0.75,
                cursor: 'default', transition: 'opacity 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.75'; }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', opacity: 0.35 }}>oldest</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', opacity: 0.35 }}>latest</span>
      </div>
    </div>
  );
}
