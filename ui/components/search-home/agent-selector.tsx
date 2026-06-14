'use client';

import { useRef, useState, useEffect } from 'react';

export type TierKey = 'auto' | 'lightweight' | 'standard' | 'full';

export const TIER_OPTIONS: { key: TierKey; label: string; value: number | undefined; desc: string }[] = [
  { key: 'auto',        label: 'Auto',       value: undefined, desc: 'Auto-detect from goal' },
  { key: 'lightweight', label: 'Lightweight', value: 1,         desc: '1 track · 1 heal · no security' },
  { key: 'standard',    label: 'Standard',    value: 2,         desc: '2 tracks · 2 heals · full scan' },
  { key: 'full',        label: 'Full Crew',   value: 3,         desc: '4 tracks · max heals · enterprise' },
];

const ACCENT = '#f97316';

export function AgentSelector({
  tierKey,
  setTierKey,
  isPending,
}: {
  tierKey: TierKey;
  setTierKey: (k: TierKey) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); setOpen(p => !p); }}
        disabled={isPending}
        style={{
          background: tierKey !== 'auto' ? `${ACCENT}18` : 'transparent',
          border: `1px solid ${tierKey !== 'auto' ? ACCENT : 'var(--border)'}`,
          borderRadius: '999px',
          padding: '0.2rem 0.65rem',
          color: tierKey !== 'auto' ? ACCENT : 'var(--text-secondary)',
          fontSize: '0.72rem',
          fontWeight: tierKey !== 'auto' ? 600 : 400,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          transition: 'all 0.12s ease',
        }}
      >
        <span style={{ opacity: 0.5, fontSize: '0.65rem' }}>Crew</span>
        {TIER_OPTIONS.find(t => t.key === tierKey)?.label}
        <span style={{ opacity: 0.4, fontSize: '0.6rem' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '10px', overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          zIndex: 200, minWidth: '200px',
        }}>
          {TIER_OPTIONS.map((opt, idx) => {
            const active = tierKey === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  setTierKey(opt.key);
                  setOpen(false);
                }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  width: '100%', padding: '0.625rem 0.875rem',
                  background: active ? `${ACCENT}12` : 'transparent',
                  border: 'none',
                  borderBottom: idx < TIER_OPTIONS.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '0.8125rem', fontWeight: active ? 600 : 400, color: active ? ACCENT : 'var(--text-primary)' }}>
                  {opt.label}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
