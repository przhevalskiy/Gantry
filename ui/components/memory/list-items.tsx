'use client';

import React from 'react';
import type { FactEntry, Episode } from './types';

export const OUTCOME_COLOR: Record<string, string> = {
  success: '#22c55e',
  partial: '#f59e0b',
  failed: '#ef4444',
  failure: '#ef4444',
};

export const AGENT_COLORS: Record<string, string> = {
  pm: '#3b82f6',
  architect: '#8b5cf6',
  builder: '#10b981',
  inspector: '#f97316',
  reviewer: '#a855f7',
  security: '#ef4444',
  devops: '#06b6d4',
};

export function AgentBadge({ agent }: { agent: string }) {
  const color = AGENT_COLORS[agent.toLowerCase()] ?? '#6b7280';
  return (
    <span style={{
      fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.06em', color, background: `${color}18`,
      border: `1px solid ${color}30`, borderRadius: 3,
      padding: '0.05rem 0.3rem', flexShrink: 0,
    }}>
      {agent}
    </span>
  );
}

export function FactCard({ factKey, entry, onClick }: {
  factKey: string;
  entry: FactEntry | string;
  onClick: () => void;
}) {
  const isRich = typeof entry === 'object' && entry !== null;
  const value = isRich ? (entry as FactEntry).value : String(entry);
  const agent = isRich ? (entry as FactEntry).agent : null;
  const updatedAt = isRich ? (entry as FactEntry).updated_at : null;
  const dateStr = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '0.6rem 0.75rem',
        borderRadius: 6,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        fontFamily: 'inherit',
        transition: 'border-color 0.1s, background 0.1s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
        <span style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.72rem', fontWeight: 600,
          color: 'var(--accent)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {factKey}
        </span>
        {agent && <AgentBadge agent={agent} />}
        {dateStr && (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 }}>
            {dateStr}
          </span>
        )}
      </div>
      <p style={{
        fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0,
        lineHeight: 1.45,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {value}
      </p>
    </button>
  );
}

export function EpisodeRow({ ep, onClick }: { ep: Episode; onClick: () => void }) {
  const date = ep.timestamp
    ? new Date(ep.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';
  const outcome = (ep.outcome ?? 'unknown').toLowerCase();
  const dotColor = OUTCOME_COLOR[outcome] ?? '#6b7280';
  const tier = ep.tier_label ?? ep.tier ?? '—';

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
        padding: '0.5rem 0.375rem',
        borderRadius: 6,
        background: 'transparent', border: '1px solid transparent',
        fontFamily: 'inherit',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.1s, border-color 0.1s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLButtonElement).style.borderBottomColor = 'var(--border)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.borderBottomColor = 'var(--border)';
      }}
    >
      <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ep.goal ?? 'No goal recorded'}
        </p>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0', opacity: 0.65 }}>
          {date}
          {' · '}
          <span style={{ color: dotColor }}>{outcome}</span>
          {typeof tier === 'string' || typeof tier === 'number' ? ` · tier ${tier}` : ''}
          {ep.quality_score != null ? ` · quality ${ep.quality_score}/10` : ''}
          {ep.heal_cycles != null && ep.heal_cycles > 0 ? ` · ${ep.heal_cycles} heal${ep.heal_cycles !== 1 ? 's' : ''}` : ''}
        </p>
      </div>
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        style={{ marginTop: 4, color: 'var(--text-secondary)', opacity: 0.35, flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  );
}
