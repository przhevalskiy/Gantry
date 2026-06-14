'use client';

import React from 'react';
import { ProjectCardComponent, IconPlus, IconFolder } from '@/components/projects/project-card';
import { resolveStatus, type ProjectCard, type ViewMode } from '@/hooks/use-project-filters';

const ACCENT = '#f97316';

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '1rem', paddingTop: '6rem',
      color: 'var(--text-secondary)',
    }}>
      <div style={{ opacity: 0.2 }}><IconFolder /></div>
      <p style={{ fontSize: '0.9375rem', margin: 0 }}>No projects yet</p>
      <button
        onClick={onNew}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: ACCENT, border: 'none', borderRadius: '8px',
          padding: '0.5rem 1rem', color: 'white',
          fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <IconPlus /> New project
      </button>
    </div>
  );
}

// ── Project grid / list ───────────────────────────────────────────────────────

export function ProjectGrid({
  cards,
  viewMode,
  groupBy,
  activeProjectId,
  onActivate,
  onDelete,
}: {
  cards: ProjectCard[];
  viewMode: ViewMode;
  groupBy: 'all' | 'status';
  activeProjectId: string | null;
  onActivate: (card: ProjectCard) => void;
  onDelete: (card: ProjectCard) => void;
}) {
  const gridStyle: React.CSSProperties = viewMode === 'grid'
    ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }
    : { display: 'flex', flexDirection: 'column', gap: '0.5rem' };

  if (groupBy === 'status') {
    // Group cards by their resolved status label category
    const groups: Record<string, ProjectCard[]> = {};
    const ORDER = ['Building', 'Action required', 'Complete', 'Failed', 'Idle', 'Other'];
    for (const card of cards) {
      const { label } = resolveStatus(card.tasks);
      const l = label.toLowerCase();
      const group = l.includes('building') || l.includes('review') || l.includes('approval') || l.includes('input') ? 'Building'
        : l.includes('action') || l.includes('blocked') ? 'Action required'
        : l.includes('complete') ? 'Complete'
        : l.includes('failed') ? 'Failed'
        : l.includes('idle') || l.includes('follow-up') || l.includes('no builds') ? 'Idle'
        : 'Other';
      if (!groups[group]) groups[group] = [];
      groups[group].push(card);
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {ORDER.filter(g => groups[g]?.length).map(group => (
          <div key={group}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', opacity: 0.5, marginBottom: '0.75rem' }}>
              {group} · {groups[group].length}
            </p>
            <div style={gridStyle}>
              {groups[group].map(card => (
                <ProjectCardComponent key={card.project.id} card={card}
                  isActive={card.project.id === activeProjectId} viewMode={viewMode}
                  onActivate={() => onActivate(card)} onDelete={() => onDelete(card)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={gridStyle}>
      {cards.map(card => (
        <ProjectCardComponent key={card.project.id} card={card}
          isActive={card.project.id === activeProjectId} viewMode={viewMode}
          onActivate={() => onActivate(card)} onDelete={() => onDelete(card)} />
      ))}
    </div>
  );
}
