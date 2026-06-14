'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FactEntry, Episode, MemoryData } from './types';
import { FactModal, EpisodeModal } from './modals';
import { FactCard, EpisodeRow } from './list-items';
import { ScoreTrend } from './score-trend';

export function ProjectMemoryPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'facts' | 'episodes'>('facts');
  const [selectedFact, setSelectedFact] = useState<{ key: string; entry: FactEntry | string } | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/memory`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(() => setError('Could not load memory'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const closeModals = useCallback(() => {
    setSelectedFact(null);
    setSelectedEpisode(null);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Loading memory…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', opacity: 0.5 }}>
        {error ?? 'No memory data'}
      </div>
    );
  }

  const factKeys = Object.keys(data.facts);
  const hasMemory = factKeys.length > 0 || data.episodes.length > 0;

  if (!hasMemory) {
    return (
      <div style={{ padding: '1rem 1.25rem' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', opacity: 0.5, margin: 0 }}>
          No memory yet — facts and episodes accumulate after each build.
        </p>
      </div>
    );
  }

  return (
    <>
      {selectedFact && (
        <FactModal factKey={selectedFact.key} entry={selectedFact.entry} onClose={closeModals} />
      )}
      {selectedEpisode && (
        <EpisodeModal ep={selectedEpisode} onClose={closeModals} />
      )}

      <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
        <ScoreTrend episodes={data.episodes} />

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.875rem' }}>
          {(['facts', 'episodes'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '0.25rem 0.625rem', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: tab === t ? 600 : 400,
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-secondary)',
                transition: 'background 0.1s',
              }}
            >
              {t === 'facts'
                ? `Facts${factKeys.length > 0 ? ` (${factKeys.length})` : ''}`
                : `Episodes${data.episodes_count > 0 ? ` (${data.episodes_count})` : ''}`}
            </button>
          ))}
        </div>

        {tab === 'facts' && (
          factKeys.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', opacity: 0.5 }}>
              No facts stored yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {factKeys.map(k => (
                <FactCard
                  key={k}
                  factKey={k}
                  entry={data.facts[k]}
                  onClick={() => setSelectedFact({ key: k, entry: data.facts[k] })}
                />
              ))}
            </div>
          )
        )}

        {tab === 'episodes' && (
          data.episodes.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', opacity: 0.5 }}>
              No episodes yet.
            </p>
          ) : (
            <div>
              {data.episodes.map((ep, i) => (
                <EpisodeRow key={i} ep={ep} onClick={() => setSelectedEpisode(ep)} />
              ))}
              {data.episodes_count > 20 && (
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.4, marginTop: '0.5rem' }}>
                  Showing last 20 of {data.episodes_count} episodes
                </p>
              )}
            </div>
          )
        )}
      </div>
    </>
  );
}
