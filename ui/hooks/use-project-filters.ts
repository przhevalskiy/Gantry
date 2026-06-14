'use client';

import { useState, useMemo } from 'react';
import { getReport } from '@/lib/report-store';
import type { LiveTask } from '@/hooks/use-all-tasks';
import type { Project } from '@/lib/project-repository';

// ── Filter types ──────────────────────────────────────────────────────────────

export type StatusFilter = 'any' | 'building' | 'complete' | 'failed' | 'idle' | 'blocked';
export type AccessFilter = 'any' | 'active' | 'inactive';
export type BuildTypeFilter = 'any' | 'single' | 'multi';
export type ViewMode = 'grid' | 'list';

export type ProjectCard = {
  project: Project;
  tasks: LiveTask[];
  activeCount: number;
  lastActivity: string | null;
  latestGoal: string | null;
};

const ACCENT = '#f97316';

// Status derived directly from Agentex task objects.
// HITL sub-states still work for tasks whose last message was cached in localStorage.
export function resolveStatus(
  tasks: LiveTask[],
): { label: string; color: string; pulsing: boolean } {
  const runningTasks = tasks.filter(t => t.status === 'RUNNING');

  if (runningTasks.length > 0) {
    for (const rt of runningTasks) {
      const content = getReport(rt.id)?.lastMessageContent ?? '';
      if (content.includes('__clarification_request__'))
        return { label: 'Needs your input', color: '#8b5cf6', pulsing: true };
      if (content.includes('"checkpoint":"architect_plan"') || content.includes('"checkpoint": "architect_plan"'))
        return { label: 'Plan review needed', color: '#3b82f6', pulsing: true };
      if (content.includes('"checkpoint":"max_heals"') || content.includes('"checkpoint": "max_heals"'))
        return { label: 'Action required', color: '#ef4444', pulsing: true };
      if (content.includes('"checkpoint":"devops"') || content.includes('"checkpoint": "devops"'))
        return { label: 'PR approval needed', color: '#06b6d4', pulsing: true };
      if (content.includes('Waiting for follow-up'))
        return { label: 'Awaiting follow-up', color: '#f59e0b', pulsing: true };
    }
    return {
      label: `${runningTasks.length} agent${runningTasks.length > 1 ? 's' : ''} building`,
      color: ACCENT,
      pulsing: true,
    };
  }

  if (tasks.length === 0) return { label: 'No builds yet', color: 'var(--text-secondary)', pulsing: false };

  const latest = tasks[0];
  if (latest.status === 'FAILED')    return { label: 'Failed',    color: '#ef4444', pulsing: false };
  if (latest.status === 'COMPLETED') return { label: 'Complete',  color: '#22c55e', pulsing: false };
  if (latest.status === 'TERMINATED' || latest.status === 'CANCELED')
    return { label: 'Stopped', color: '#6b7280', pulsing: false };
  if (latest.status === 'TIMED_OUT') return { label: 'Timed out', color: '#f59e0b', pulsing: false };
  return { label: 'Idle', color: 'var(--text-secondary)', pulsing: false };
}

export function useProjectFilters(cards: ProjectCard[], activeProjectId: string | null) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('any');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('any');
  const [buildTypeFilter, setBuildTypeFilter] = useState<BuildTypeFilter>('any');
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('ks_projects_view') as ViewMode ?? 'grid') : 'grid'
  );
  const [groupBy, setGroupBy] = useState<'all' | 'status'>('all');

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const nameMatch = card.project.name.toLowerCase().includes(q);
        const slugMatch = card.project.slug.toLowerCase().includes(q);
        const queryMatch = card.tasks.some(t => t.goal?.toLowerCase().includes(q));
        if (!nameMatch && !slugMatch && !queryMatch) return false;
      }

      // Status filter
      if (statusFilter !== 'any') {
        const { label } = resolveStatus(card.tasks);
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
      if (buildTypeFilter === 'single' && card.tasks.length !== 1) return false;
      if (buildTypeFilter === 'multi' && card.tasks.length <= 1) return false;

      return true;
    });
  }, [cards, search, statusFilter, accessFilter, buildTypeFilter, activeProjectId]);

  function clearFilters() {
    setSearch('');
    setStatusFilter('any');
    setAccessFilter('any');
    setBuildTypeFilter('any');
  }

  const activeFiltersCount = [
    statusFilter !== 'any',
    accessFilter !== 'any',
    buildTypeFilter !== 'any',
    search.trim() !== '',
  ].filter(Boolean).length;

  return {
    search, setSearch,
    statusFilter, setStatusFilter,
    accessFilter, setAccessFilter,
    buildTypeFilter, setBuildTypeFilter,
    viewMode, setViewMode,
    groupBy, setGroupBy,
    filteredCards,
    clearFilters,
    activeFiltersCount,
  };
}
