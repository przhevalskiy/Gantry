'use client';

import React, { useEffect } from 'react';
import type { FactEntry, Episode } from './types';
import { AGENT_COLORS, OUTCOME_COLOR } from './list-items';

function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--background)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '100%', maxWidth: 560,
          maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '1.125rem 1.5rem 0.875rem',
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, background: 'var(--background)', zIndex: 1,
    }}>
      <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</p>
      <button
        onClick={onClose}
        style={{
          background: 'transparent', border: '1px solid transparent', borderRadius: 6,
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1,
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        ✕
      </button>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.6, minWidth: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

export function FactModal({ factKey, entry, onClose }: { factKey: string; entry: FactEntry | string; onClose: () => void }) {
  const isRich = typeof entry === 'object' && entry !== null;
  const fact = entry as FactEntry;
  const value = isRich ? fact.value : String(entry);
  const agent = isRich ? fact.agent : null;
  const confidence = isRich ? fact.confidence : null;
  const updatedAt = isRich ? fact.updated_at : null;
  const agentColor = agent ? (AGENT_COLORS[agent.toLowerCase()] ?? '#6b7280') : null;

  const dateFull = updatedAt
    ? new Date(updatedAt).toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalHeader title="Fact detail" onClose={onClose} />
      <div style={{ padding: '1.25rem 1.5rem' }}>
        {/* Key */}
        <div style={{
          fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8rem', fontWeight: 600,
          color: 'var(--accent)', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '1rem',
          wordBreak: 'break-all',
        }}>
          {factKey}
        </div>

        {/* Value */}
        <div style={{
          fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1.25rem',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {value}
        </div>

        {/* Metadata */}
        <div>
          {agent && (
            <MetaRow label="Written by" value={
              <span style={{ color: agentColor ?? undefined, fontWeight: 600 }}>{agent}</span>
            } />
          )}
          {confidence != null && (
            <MetaRow label="Confidence" value={`${Math.round(confidence * 100)}%`} />
          )}
          {dateFull && <MetaRow label="Last updated" value={dateFull} />}
        </div>
      </div>
    </ModalBackdrop>
  );
}

export function EpisodeModal({ ep, onClose }: { ep: Episode; onClose: () => void }) {
  const outcome = (ep.outcome ?? 'unknown').toLowerCase();
  const dotColor = OUTCOME_COLOR[outcome] ?? '#6b7280';
  const tier = ep.tier_label ?? ep.tier ?? '—';
  const dateFull = ep.timestamp
    ? new Date(ep.timestamp).toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalHeader title="Episode detail" onClose={onClose} />
      <div style={{ padding: '1.25rem 1.5rem' }}>
        {/* Outcome pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: dotColor, textTransform: 'capitalize' }}>
            {outcome}
          </span>
        </div>

        {/* Goal */}
        <div style={{
          fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1.25rem',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {ep.goal ?? 'No goal recorded'}
        </div>

        {/* Metadata */}
        <div style={{ marginBottom: ep.key_decisions?.length ? '1.25rem' : 0 }}>
          {dateFull && <MetaRow label="Timestamp" value={dateFull} />}
          <MetaRow label="Tier" value={String(tier)} />
          {ep.quality_score != null && (
            <MetaRow label="Quality score" value={
              <span>
                <span style={{ fontWeight: 600 }}>{ep.quality_score}</span>
                <span style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>/10</span>
              </span>
            } />
          )}
          {ep.heal_cycles != null && (
            <MetaRow label="Heal cycles" value={String(ep.heal_cycles)} />
          )}
          {ep.pr_url && (
            <MetaRow label="PR" value={
              <a href={ep.pr_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                {ep.pr_url}
              </a>
            } />
          )}
          {ep.repo_path && (
            <MetaRow label="Repo path" value={
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', opacity: 0.7 }}>
                {ep.repo_path}
              </span>
            } />
          )}
        </div>

        {/* Key decisions */}
        {ep.key_decisions && ep.key_decisions.length > 0 && (
          <div>
            <p style={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
            }}>
              Key decisions
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.125rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {ep.key_decisions.map((d, i) => (
                <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ModalBackdrop>
  );
}
