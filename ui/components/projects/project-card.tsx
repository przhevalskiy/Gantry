'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ProjectMemoryPanel } from '@/components/project-memory-panel';
import { resolveStatus, type ProjectCard, type ViewMode } from '@/hooks/use-project-filters';

const ACCENT = '#f97316';

// ── Icons ─────────────────────────────────────────────────────────────────────

export function IconFolder() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

export function IconPlus() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  );
}

function PulsingDot({ color, pulsing }: { color: string; pulsing: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: color, flexShrink: 0,
      animation: pulsing ? 'pulse-dot 1.4s ease-in-out infinite' : 'none',
    }} />
  );
}

// ── Card menu ─────────────────────────────────────────────────────────────────

function CardMenu({ onActivate, onCopy, onDelete, copied }: {
  onActivate: () => void;
  onCopy: () => void;
  onDelete: () => void;
  copied: boolean;
}) {
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 4px)', right: 0,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '10px', overflow: 'hidden',
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      zIndex: 100, minWidth: '160px',
    }}>
      <button onClick={onActivate}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.6rem 0.875rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', color: 'var(--text-primary)', textAlign: 'left' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        Set as active
      </button>
      <button onClick={onCopy}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.6rem 0.875rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', color: 'var(--text-primary)', textAlign: 'left' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        {copied ? '✓ Copied' : 'Copy link'}
      </button>
      <button onClick={onDelete}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.6rem 0.875rem', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', color: '#ef4444', textAlign: 'left' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ef444410'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
        Delete project
      </button>
    </div>
  );
}

// ── Status dot for task rows ──────────────────────────────────────────────────

const TASK_STATUS_STYLE: Record<string, { label: string; color: string; pulse: boolean }> = {
  RUNNING:    { label: 'Running',   color: '#3b82f6', pulse: true  },
  COMPLETED:  { label: 'Done',      color: '#22c55e', pulse: false },
  FAILED:     { label: 'Failed',    color: '#ef4444', pulse: false },
  TERMINATED: { label: 'Stopped',   color: '#6b7280', pulse: false },
  CANCELED:   { label: 'Cancelled', color: '#6b7280', pulse: false },
  TIMED_OUT:  { label: 'Timed out', color: '#f59e0b', pulse: false },
};

function TaskStatusDot({ status }: { status: string }) {
  const s = TASK_STATUS_STYLE[status] ?? { label: status, color: '#6b7280', pulse: false };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0,
        animation: s.pulse ? 'taskRowPulse 1.4s ease-in-out infinite' : 'none',
      }} />
      <span style={{ fontSize: '0.7rem', color: s.color, fontWeight: 500, minWidth: '3rem' }}>{s.label}</span>
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Project card ──────────────────────────────────────────────────────────────

export function ProjectCardComponent({
  card,
  onDelete,
  onActivate,
  isActive = false,
  viewMode = 'grid',
}: {
  card: ProjectCard;
  onDelete: () => void;
  onActivate: () => void;
  isActive?: boolean;
  viewMode?: ViewMode;
}) {
  const { project, tasks } = card;
  const { label, color, pulsing } = resolveStatus(tasks);
  const lastDate = card.lastActivity ? new Date(card.lastActivity) : null;
  const relativeTime = lastDate ? formatRelative(lastDate) : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const visibleTasks = tasks.slice(0, 5);

  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  function handleCopyLink() {
    setMenuOpen(false);
    const latest = tasks[0];
    const url = latest ? `${window.location.origin}/task/${latest.id}` : window.location.origin;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      position: 'relative',
      background: 'var(--surface)',
      border: `1px solid ${isActive ? ACCENT + '60' : 'var(--border)'}`,
      borderRadius: viewMode === 'list' ? '10px' : '14px',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      boxShadow: isActive ? `0 0 0 1px ${ACCENT}30` : 'none',
    }}>
      <style>{`@keyframes taskRowPulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }`}</style>

      {/* Header — click to activate this project */}
      <div
        onClick={onActivate}
        style={{
          padding: viewMode === 'list' ? '0.75rem 1rem' : '1rem 1.25rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: viewMode === 'list' ? '1rem' : '0.625rem',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-raised)'; (e.currentTarget as HTMLDivElement).style.borderRadius = viewMode === 'list' ? '10px' : '14px 14px 0 0'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      >
        <span style={{ color: 'var(--text-secondary)', display: 'flex', opacity: 0.6, flexShrink: 0 }}><IconFolder /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: viewMode === 'list' ? '0.875rem' : '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
            {project.name}
            {isActive && <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', fontWeight: 700, color: ACCENT, background: `${ACCENT}18`, border: `1px solid ${ACCENT}40`, borderRadius: '4px', padding: '0.05rem 0.3rem', verticalAlign: 'middle' }}>active</span>}
          </p>
          {viewMode !== 'list' && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.1rem 0 0', opacity: 0.5 }}>{project.slug}</p>
          )}
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, flex: viewMode === 'list' ? '0 0 160px' : undefined }}>
          <PulsingDot color={color} pulsing={pulsing} />
          <span style={{ fontSize: '0.75rem', color, fontWeight: 500 }}>{label}</span>
        </div>

        {viewMode === 'list' && (
          <>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', opacity: 0.4, flexShrink: 0 }}>{relativeTime}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', opacity: 0.4, flexShrink: 0 }}>{tasks.length} build{tasks.length !== 1 ? 's' : ''}</span>
          </>
        )}

        {/* ⋯ menu */}
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0, marginLeft: viewMode === 'list' ? 'auto' : undefined }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setMenuOpen(o => !o)} title="Project actions" style={{ background: menuOpen ? 'var(--surface-raised)' : 'transparent', border: `1px solid ${menuOpen ? 'var(--border)' : 'transparent'}`, borderRadius: '6px', padding: '0.15rem 0.45rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.4, fontFamily: 'inherit', display: 'flex', alignItems: 'center', transition: 'background 0.1s, border-color 0.1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
            onMouseLeave={e => { if (!menuOpen) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; } }}
          >⋯</button>
          {menuOpen && <CardMenu onActivate={() => { setMenuOpen(false); onActivate(); }} onCopy={handleCopyLink} onDelete={() => { setMenuOpen(false); onDelete(); }} copied={copied} />}
        </div>
      </div>

      {/* Task list — grid mode only */}
      {viewMode !== 'list' && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '0.25rem 0 0.5rem' }}>
          {tasks.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.4, padding: '0.5rem 1.25rem' }}>No builds yet</p>
          ) : (
            <>
              {visibleTasks.map(t => {
                const age = t.created_at ? (() => {
                  const diff = Date.now() - new Date(t.created_at).getTime();
                  const m = Math.floor(diff / 60000);
                  if (m < 1) return 'just now';
                  if (m < 60) return `${m}m ago`;
                  return `${Math.floor(m / 60)}h ago`;
                })() : null;
                return (
                  <Link key={t.id} href={`/task/${t.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 1.25rem', textDecoration: 'none', background: 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-raised)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
                  >
                    <TaskStatusDot status={t.status ?? 'UNKNOWN'} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.goal ?? t.id}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.45, flexShrink: 0 }}>{age}</span>
                  </Link>
                );
              })}
              {tasks.length > 5 && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', opacity: 0.4, padding: '0.25rem 1.25rem 0', margin: 0 }}>
                  +{tasks.length - 5} more
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Memory toggle — grid mode only */}
      {viewMode !== 'list' && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setMemoryOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.4rem 1.25rem', background: 'transparent', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 500,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            Memory
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ marginLeft: 'auto', transform: memoryOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {memoryOpen && <ProjectMemoryPanel projectId={project.id} />}
        </div>
      )}
    </div>
  );
}
