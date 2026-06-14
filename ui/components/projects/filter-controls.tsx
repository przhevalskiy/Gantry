'use client';

import { useState, useEffect, useRef } from 'react';
import type { StatusFilter, AccessFilter, BuildTypeFilter, ViewMode } from '@/hooks/use-project-filters';

const ACCENT = '#f97316';

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

// ── Filter controls ───────────────────────────────────────────────────────────

export function FilterControls({
  search, setSearch,
  statusFilter, setStatusFilter,
  accessFilter, setAccessFilter,
  buildTypeFilter, setBuildTypeFilter,
  viewMode, setViewMode,
  groupBy, setGroupBy,
  activeFiltersCount,
  clearFilters,
}: {
  search: string;
  setSearch: (v: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  accessFilter: AccessFilter;
  setAccessFilter: (v: AccessFilter) => void;
  buildTypeFilter: BuildTypeFilter;
  setBuildTypeFilter: (v: BuildTypeFilter) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  groupBy: 'all' | 'status';
  setGroupBy: (v: 'all' | 'status') => void;
  activeFiltersCount: number;
  clearFilters: () => void;
}) {
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

  return (
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
          onClick={clearFilters}
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
  );
}
