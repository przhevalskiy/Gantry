'use client';

import { STATUS_LABEL, STATUS_COLOR } from './utils';

export function ReportCard({ report, coveragePct }: { report: string; coveragePct: number | null }) {
  const covColor = coveragePct == null ? 'var(--text-secondary)'
    : coveragePct >= 80 ? 'var(--success)'
    : coveragePct >= 60 ? 'var(--warning)'
    : 'var(--error)';

  return (
    <div style={{
      padding: '1.25rem',
      background: 'var(--surface-raised)',
      borderRadius: '12px',
      border: '1px solid var(--border)',
    }}>
      {coveragePct != null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: '0.875rem', padding: '0.4rem 0.625rem',
          background: `color-mix(in srgb, ${covColor} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${covColor} 30%, transparent)`,
          borderRadius: '6px',
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: covColor }}>
            📊 Test coverage: {coveragePct.toFixed(1)}%
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
            {coveragePct >= 80 ? '✓ Good' : coveragePct >= 60 ? '⚠ Acceptable' : '✗ Low — add more tests'}
          </span>
        </div>
      )}
      <pre style={{
        fontFamily: 'inherit',
        fontSize: '0.8125rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        margin: 0,
      }}>
        {report}
      </pre>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  const color = STATUS_COLOR[status] ?? 'var(--text-secondary)';
  const isRunning = status === 'RUNNING';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      padding: '0.25rem 0.75rem',
      borderRadius: '999px',
      background: `${color}22`,
      border: `1px solid ${color}44`,
      flexShrink: 0,
    }}>
      {isRunning && (
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color, display: 'inline-block',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      )}
      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{label}</span>
    </div>
  );
}
