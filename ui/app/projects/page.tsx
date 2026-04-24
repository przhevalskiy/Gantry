'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { listProjects, deleteProject, type Project } from '@/lib/project-repository';
import { getReportsByProject, deleteReportsByProject, type SavedReport } from '@/lib/report-store';
import { useTaskStatuses } from '@/hooks/use-task-statuses';
import { useProjectStore } from '@/lib/project-store';

const ACCENT = '#f97316';

// ── Filter types ──────────────────────────────────────────────────────────────

type StatusFilter = 'any' | 'building' | 'complete' | 'failed' | 'idle' | 'blocked';
type AccessFilter = 'any' | 'active' | 'inactive';
type BuildTypeFilter = 'any' | 'single' | 'multi';
type ViewMode = 'grid' | 'list';

// ── Status polling ────────────────────────────────────────────────────────────

type TaskStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED' | string;

type ProjectCard = {
  project: Project;
  reports: SavedReport[];
  activeCount: number;
  lastActivity: string | null;
  latestSummary: string | null;
  nextStep: string | null;
};

function extractNextStep(summary: string | null): string | null {
  if (!summary) return null;
  const healMatch = summary.match(/Remaining QA Issues\n(- .+)/);
  if (healMatch) return healMatch[1].replace(/^- /, '');
  const secMatch = summary.match(/Security Findings.*\n(- .+)/);
  if (secMatch) return secMatch[1].replace(/^- \[.*?\] /, '');
  if (summary.includes('✓ Complete')) return 'Build complete — ready for follow-up.';
  if (summary.includes('⚠ Blocked')) return 'Resolve blocking issue before proceeding.';
  return null;
}

// Derive status from live Agentex data + local report store messages
function resolveStatus(
  reports: SavedReport[],
  liveStatuses: Map<string, string>,
): { label: string; color: string; pulsing: boolean } {
  // Find all currently RUNNING tasks for this project
  const runningReports = reports.filter(r => liveStatuses.get(r.taskId) === 'RUNNING');

  if (runningReports.length > 0) {
    // Check the latest message content stored in the report for HITL/wait signals
    const latestRunning = runningReports[0];
    const content = latestRunning.lastMessageContent ?? '';

    // PM clarification — asking questions before planning
    if (content.includes('__clarification_request__')) {
      return { label: 'Needs your input', color: '#8b5cf6', pulsing: true };
    }
    // Architect plan review
    if (content.includes('"checkpoint":"architect_plan"') || content.includes('"checkpoint": "architect_plan"')) {
      return { label: 'Plan review needed', color: '#3b82f6', pulsing: true };
    }
    // Heal exhaustion — proceed or abort
    if (content.includes('"checkpoint":"max_heals"') || content.includes('"checkpoint": "max_heals"')) {
      return { label: 'Action required', color: '#ef4444', pulsing: true };
    }
    // DevOps / PR approval
    if (content.includes('"checkpoint":"devops"') || content.includes('"checkpoint": "devops"')) {
      return { label: 'PR approval needed', color: '#06b6d4', pulsing: true };
    }
    // Follow-up wait loop
    if (content.includes('Waiting for follow-up')) {
      return { label: 'Awaiting follow-up', color: '#f59e0b', pulsing: true };
    }
    // Actively building
    return {
      label: `${runningReports.length} agent${runningReports.length > 1 ? 's' : ''} building`,
      color: ACCENT,
      pulsing: true,
    };
  }

  if (reports.length === 0) return { label: 'No builds yet', color: 'var(--text-secondary)', pulsing: false };

  const latest = reports[0];
  const latestLive = liveStatuses.get(latest.taskId);

  if (latestLive === 'FAILED' || latest.summary?.includes('Failed')) {
    return { label: 'Failed', color: '#ef4444', pulsing: false };
  }
  if (latest.summary?.includes('✓ Complete') || latestLive === 'COMPLETED') {
    return { label: 'Complete', color: '#22c55e', pulsing: false };
  }
  if (latest.summary?.includes('⚠ Blocked')) {
    return { label: 'Blocked', color: '#ef4444', pulsing: false };
  }
  return { label: 'Idle', color: 'var(--text-secondary)', pulsing: false };
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconFolder() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6"/>
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

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({
  card,
  liveStatuses,
  onClick,
  onDelete,
  onActivate,
  isActive = false,
  viewMode = 'grid',
}: {
  card: ProjectCard;
  liveStatuses: Map<string, string>;
  onClick: () => void;
  onDelete: () => void;
  onActivate: () => void;
  isActive?: boolean;
  viewMode?: ViewMode;
}) {
  const { project, reports } = card;
  const { label, color, pulsing } = resolveStatus(reports, liveStatuses);
  const latestQuery = reports[0]?.query ?? null;
  const nextStep = card.nextStep;
  const lastDate = card.lastActivity ? new Date(card.lastActivity) : null;
  const relativeTime = lastDate ? formatRelative(lastDate) : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  function handleCopyLink() {
    setMenuOpen(false);
    const latest = reports[0];
    const url = latest
      ? `${window.location.origin}/task/${latest.taskId}`
      : window.location.origin;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Use a div as the card container so the menu can sit outside the clickable area
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--surface)',
        border: `1px solid ${isActive ? ACCENT + '60' : 'var(--border)'}`,
        borderRadius: viewMode === 'list' ? '10px' : '14px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        cursor: 'pointer',
        boxShadow: isActive ? `0 0 0 1px ${ACCENT}30` : 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = ACCENT + '80';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px ${ACCENT}12`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isActive ? ACCENT + '60' : 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = isActive ? `0 0 0 1px ${ACCENT}30` : 'none';
      }}
    >


      {/* Clickable card body */}
      <div
        onClick={onClick}
        style={{
          padding: viewMode === 'list' ? '0.75rem 1rem' : '1.25rem',
          display: 'flex',
          flexDirection: viewMode === 'list' ? 'row' : 'column',
          alignItems: viewMode === 'list' ? 'center' : undefined,
          gap: viewMode === 'list' ? '1rem' : '0.875rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: viewMode === 'list' ? '0 0 220px' : undefined }}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', opacity: 0.6 }}><IconFolder /></span>
            <div>
              <p style={{ fontSize: viewMode === 'list' ? '0.875rem' : '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                {card.project.name}
                {isActive && <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', fontWeight: 700, color: ACCENT, background: `${ACCENT}18`, border: `1px solid ${ACCENT}40`, borderRadius: '4px', padding: '0.05rem 0.3rem', verticalAlign: 'middle' }}>active</span>}
              </p>
              {viewMode !== 'list' && (
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0', opacity: 0.6 }}>
                  {card.project.slug}
                </p>
              )}
            </div>
          </div>
          {/* ⋯ menu — only shown in grid mode inline; in list mode it's at the end */}
          {viewMode !== 'list' && (
            <div
              ref={menuRef}
              style={{ position: 'relative', flexShrink: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setMenuOpen(o => !o)}
                title="Project actions"
                style={{
                  background: menuOpen ? 'var(--surface-raised)' : 'transparent',
                  border: `1px solid ${menuOpen ? 'var(--border)' : 'transparent'}`,
                  borderRadius: '6px', padding: '0.15rem 0.45rem',
                  cursor: 'pointer', color: 'var(--text-secondary)',
                  fontSize: '1.1rem', lineHeight: 1.4, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center',
                  transition: 'background 0.1s, border-color 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                }}
                onMouseLeave={e => {
                  if (!menuOpen) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                  }
                }}
              >
                ⋯
              </button>

              {menuOpen && <CardMenu onActivate={() => { setMenuOpen(false); onActivate(); }} onCopy={handleCopyLink} onDelete={() => { setMenuOpen(false); onDelete(); }} copied={copied} />}
            </div>
          )}
        </div>

        {/* Status row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: viewMode === 'list' ? '0 0 160px' : undefined }}>
          <PulsingDot color={color} pulsing={pulsing} />
          <span style={{ fontSize: '0.78rem', color, fontWeight: 500 }}>{label}</span>
          {viewMode !== 'list' && relativeTime && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: 'auto', opacity: 0.5 }}>
              {relativeTime}
            </span>
          )}
        </div>

        {/* Latest task */}
        {latestQuery && viewMode !== 'list' && (
          <div style={{ background: 'var(--surface-raised)', borderRadius: '8px', padding: '0.5rem 0.625rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', margin: '0 0 0.2rem', opacity: 0.5 }}>
              Last build
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {latestQuery}
            </p>
          </div>
        )}

        {/* Latest task — list mode compact */}
        {latestQuery && viewMode === 'list' && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {latestQuery}
          </p>
        )}

        {/* Crew recommendation */}
        {nextStep && viewMode !== 'list' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ACCENT, flexShrink: 0, marginTop: '0.05rem' }}>
              Crew
            </span>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {nextStep}
            </p>
          </div>
        )}

        {/* Build count + time */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: viewMode === 'list' ? 0 : 'auto', flexShrink: 0 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', opacity: 0.5 }}>
            {reports.length} build{reports.length !== 1 ? 's' : ''}
          </span>
          {viewMode === 'list' && relativeTime && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '0.75rem', opacity: 0.4 }}>
              {relativeTime}
            </span>
          )}
        </div>

        {/* List mode ⋯ menu */}
        {viewMode === 'list' && (
          <div
            ref={menuRef}
            style={{ position: 'relative', flexShrink: 0, marginLeft: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setMenuOpen(o => !o)}
              title="Project actions"
              style={{
                background: menuOpen ? 'var(--surface-raised)' : 'transparent',
                border: `1px solid ${menuOpen ? 'var(--border)' : 'transparent'}`,
                borderRadius: '6px', padding: '0.15rem 0.45rem',
                cursor: 'pointer', color: 'var(--text-secondary)',
                fontSize: '1.1rem', lineHeight: 1.4, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center',
              }}
            >
              ⋯
            </button>
            {menuOpen && <CardMenu onActivate={() => { setMenuOpen(false); onActivate(); }} onCopy={handleCopyLink} onDelete={() => { setMenuOpen(false); onDelete(); }} copied={copied} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Filter dropdown ───────────────────────────────────────────────────────────

function FilterDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value) ?? options[0];
  const isFiltered = value !== options[0].value;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          height: '32px', padding: '0 0.625rem',
          background: isFiltered ? `${ACCENT}15` : (open ? 'var(--surface-raised)' : 'var(--surface)'),
          border: `1px solid ${isFiltered ? ACCENT + '50' : 'var(--border)'}`,
          borderRadius: '7px', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: '0.8rem',
          color: isFiltered ? ACCENT : 'var(--text-secondary)',
        }}
      >
        {current.label}
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '10px', overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          zIndex: 50, minWidth: '150px',
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                width: '100%', padding: '0.55rem 0.875rem',
                background: value === opt.value ? 'var(--surface-raised)' : 'transparent',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '0.8rem', color: 'var(--text-primary)', textAlign: 'left',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)'; }}
              onMouseLeave={e => { if (value !== opt.value) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              {value === opt.value && <span style={{ color: ACCENT, fontSize: '0.7rem', flexShrink: 0 }}>✓</span>}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Project grid / list ───────────────────────────────────────────────────────

function ProjectGrid({
  cards,
  statusMap,
  viewMode,
  groupBy,
  activeProjectId,
  onNavigate,
  onActivate,
  onDelete,
}: {
  cards: ProjectCard[];
  statusMap: Map<string, string>;
  viewMode: ViewMode;
  groupBy: 'all' | 'status';
  activeProjectId: string | null;
  onNavigate: (card: ProjectCard) => void;
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
      const { label } = resolveStatus(card.reports, statusMap);
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
                <ProjectCard key={card.project.id} card={card} liveStatuses={statusMap}
                  isActive={card.project.id === activeProjectId} viewMode={viewMode}
                  onClick={() => onNavigate(card)} onActivate={() => onActivate(card)} onDelete={() => onDelete(card)} />
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
        <ProjectCard key={card.project.id} card={card} liveStatuses={statusMap}
          isActive={card.project.id === activeProjectId} viewMode={viewMode}
          onClick={() => onNavigate(card)} onActivate={() => onActivate(card)} onDelete={() => onDelete(card)} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectCard | null>(null);
  const { activeProjectId, setActiveProjectId } = useProjectStore();

  // ── Filter + view state ───────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('any');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('any');
  const [buildTypeFilter, setBuildTypeFilter] = useState<BuildTypeFilter>('any');
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('ks_projects_view') as ViewMode ?? 'grid') : 'grid'
  );
  const [groupBy, setGroupBy] = useState<'all' | 'status'>('all');
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!groupMenuOpen) return;
    const h = (e: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) setGroupMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [groupMenuOpen]);

  const loadCards = useCallback(async () => {
    try {
      const projects = await listProjects();
      const built: ProjectCard[] = projects.map(project => {
        const reports = getReportsByProject(project.id);
        const activeCount = 0;
        const lastActivity = reports[0]?.createdAt ?? project.created_at;
        const latestSummary = reports.find(r => r.summary)?.summary ?? null;
        const nextStep = extractNextStep(latestSummary);
        return { project, reports, activeCount, lastActivity, latestSummary, nextStep };
      });
      setCards(built);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  const handleDelete = useCallback(async (card: ProjectCard) => {
    setDeletingId(card.project.id);
    setConfirmDelete(null);
    try {
      const taskIds = card.reports.map(r => r.taskId).filter(Boolean);
      await deleteProject(card.project.id, taskIds);
      // Clear localStorage reports for this project
      deleteReportsByProject(card.project.id);
      // Deselect if this was the active project
      if (activeProjectId === card.project.id) {
        setActiveProjectId(null);
      }
      // Reload cards
      await loadCards();
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDeletingId(null);
    }
  }, [activeProjectId, setActiveProjectId, loadCards]);

  // Collect all task IDs across all projects for live status polling
  const allTaskIds = useMemo(
    () => cards.flatMap(c => c.reports.map(r => r.taskId)).filter(Boolean),
    [cards]
  );

  const { data: liveStatuses } = useTaskStatuses(allTaskIds);

  // Build a map of taskId → status for O(1) lookup in cards
  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    (liveStatuses ?? []).forEach(s => m.set(s.taskId, s.status));
    return m;
  }, [liveStatuses]);

  // ── Filtered + searched cards ─────────────────────────────────────────────
  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const nameMatch = card.project.name.toLowerCase().includes(q);
        const slugMatch = card.project.slug.toLowerCase().includes(q);
        const queryMatch = card.reports.some(r => r.query?.toLowerCase().includes(q));
        if (!nameMatch && !slugMatch && !queryMatch) return false;
      }

      // Status filter
      if (statusFilter !== 'any') {
        const { label } = resolveStatus(card.reports, statusMap);
        const l = label.toLowerCase();
        if (statusFilter === 'building' && !l.includes('building') && !l.includes('review') && !l.includes('approval') && !l.includes('input')) return false;
        if (statusFilter === 'complete' && !l.includes('complete')) return false;
        if (statusFilter === 'failed' && !l.includes('failed') && !l.includes('blocked')) return false;
        if (statusFilter === 'idle' && !l.includes('idle') && !l.includes('follow-up') && !l.includes('no builds')) return false;
        if (statusFilter === 'blocked' && !l.includes('blocked') && !l.includes('action') && !l.includes('review') && !l.includes('approval') && !l.includes('input')) return false;
      }

      // Access filter
      if (accessFilter === 'active' && card.project.id !== activeProjectId) return false;
      if (accessFilter === 'inactive' && card.project.id === activeProjectId) return false;

      // Build type filter
      if (buildTypeFilter === 'single' && card.reports.length !== 1) return false;
      if (buildTypeFilter === 'multi' && card.reports.length <= 1) return false;

      return true;
    });
  }, [cards, search, statusFilter, accessFilter, buildTypeFilter, statusMap, activeProjectId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.3; } }`}</style>
      </div>
    );
  }

  const activeFiltersCount = [
    statusFilter !== 'any',
    accessFilter !== 'any',
    buildTypeFilter !== 'any',
    search.trim() !== '',
  ].filter(Boolean).length;

  return (
    <div style={{ minHeight: '100vh', padding: '2.5rem 2.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        .project-card-wrap:hover .delete-btn { opacity: 1 !important; }
      `}</style>

      {/* Confirmation modal */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '14px', padding: '1.75rem',
              maxWidth: '420px', width: '100%',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}
          >
            <div>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Delete "{confirmDelete.project.name}"?
              </p>
              <p style={{ fontSize: '0.8375rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0', lineHeight: 1.5 }}>
                This will permanently delete the project, all {confirmDelete.reports.length} build record{confirmDelete.reports.length !== 1 ? 's' : ''}, the repo directory, and terminate any running Temporal workflows. This cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '0.5rem 1rem',
                  fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
                  color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deletingId === confirmDelete.project.id}
                style={{
                  background: '#ef4444', border: 'none',
                  borderRadius: '8px', padding: '0.5rem 1rem',
                  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', color: 'white',
                  opacity: deletingId ? 0.6 : 1,
                }}
              >
                {deletingId === confirmDelete.project.id ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          Projects
        </h1>
        <button
          onClick={() => router.push('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: ACCENT, border: 'none', borderRadius: '8px',
            padding: '0.5rem 1rem', color: 'white',
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <IconPlus /> New build
        </button>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        marginBottom: '1.5rem', flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', opacity: 0.5, pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            style={{
              paddingLeft: '2rem', paddingRight: '0.625rem',
              height: '32px', width: '160px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '7px', fontFamily: 'inherit',
              fontSize: '0.8rem', color: 'var(--text-primary)', outline: 'none',
            }}
          />
        </div>

        {/* Status filter */}
        <FilterDropdown
          value={statusFilter}
          options={[
            { value: 'any', label: 'Any status' },
            { value: 'building', label: 'Building' },
            { value: 'complete', label: 'Complete' },
            { value: 'failed', label: 'Failed' },
            { value: 'idle', label: 'Idle' },
            { value: 'blocked', label: 'Blocked' },
          ]}
          onChange={v => setStatusFilter(v as StatusFilter)}
        />

        {/* Access filter */}
        <FilterDropdown
          value={accessFilter}
          options={[
            { value: 'any', label: 'Any access' },
            { value: 'active', label: 'Active project' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          onChange={v => setAccessFilter(v as AccessFilter)}
        />

        {/* Build type filter */}
        <FilterDropdown
          value={buildTypeFilter}
          options={[
            { value: 'any', label: 'Any build type' },
            { value: 'single', label: 'Single build' },
            { value: 'multi', label: 'Multiple builds' },
          ]}
          onChange={v => setBuildTypeFilter(v as BuildTypeFilter)}
        />

        {/* Clear filters */}
        {activeFiltersCount > 0 && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('any'); setAccessFilter('any'); setBuildTypeFilter('any'); }}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: '7px', padding: '0 0.625rem', height: '32px',
              fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}
          >
            ✕ Clear {activeFiltersCount}
          </button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Group by / All projects dropdown */}
        <div ref={groupMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setGroupMenuOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: groupMenuOpen ? 'var(--surface-raised)' : 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: '7px',
              padding: '0 0.75rem', height: '32px',
              fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {groupBy === 'all' ? 'All projects' : 'By status'}
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {groupMenuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '10px', overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              zIndex: 50, minWidth: '150px',
            }}>
              {(['all', 'status'] as const).map(opt => (
                <button key={opt} onClick={() => { setGroupBy(opt); setGroupMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    width: '100%', padding: '0.55rem 0.875rem',
                    background: groupBy === opt ? 'var(--surface-raised)' : 'transparent',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '0.8rem', color: 'var(--text-primary)', textAlign: 'left',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)'; }}
                  onMouseLeave={e => { if (groupBy !== opt) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  {groupBy === opt && <span style={{ color: ACCENT, fontSize: '0.7rem' }}>✓</span>}
                  {opt === 'all' ? 'All projects' : 'Group by status'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View mode toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '7px', overflow: 'hidden' }}>
          {(['grid', 'list'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); localStorage.setItem('ks_projects_view', mode); }}
              title={mode === 'grid' ? 'Grid view' : 'List view'}
              style={{
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: viewMode === mode ? 'var(--surface-raised)' : 'transparent',
                border: 'none', cursor: 'pointer',
                color: viewMode === mode ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderLeft: mode === 'list' ? '1px solid var(--border)' : 'none',
              }}
            >
              {mode === 'grid' ? (
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              ) : (
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      {(activeFiltersCount > 0 || search) && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', opacity: 0.6, marginBottom: '1rem' }}>
          {filteredCards.length} of {cards.length} project{cards.length !== 1 ? 's' : ''}
        </p>
      )}

      {cards.length === 0 ? (
        <EmptyState onNew={() => router.push('/')} />
      ) : filteredCards.length === 0 ? (
        <div style={{ paddingTop: '4rem', textAlign: 'center', color: 'var(--text-secondary)', opacity: 0.5 }}>
          <p style={{ fontSize: '0.9rem' }}>No projects match your filters</p>
        </div>
      ) : (
        <ProjectGrid
          cards={filteredCards}
          statusMap={statusMap}
          viewMode={viewMode}
          groupBy={groupBy}
          activeProjectId={activeProjectId}
          onNavigate={(card) => {
            const latest = card.reports[0];
            if (latest) router.push(`/task/${latest.taskId}`);
            else router.push('/');
          }}
          onActivate={(card) => setActiveProjectId(card.project.id)}
          onDelete={(card) => setConfirmDelete(card)}
        />
      )}
    </div>
  );
}
