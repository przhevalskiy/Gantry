'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { listProjects, deleteProject, type Project } from '@/lib/project-repository';
import { deleteReportsByProject } from '@/lib/report-store';
import { useAllTasks } from '@/hooks/use-all-tasks';
import { useProjectStore } from '@/lib/project-store';
import { useProjectFilters, type ProjectCard } from '@/hooks/use-project-filters';
import { useServerPreferences } from '@/hooks/use-server-preferences';
import { FilterControls } from '@/components/projects/filter-controls';
import { ProjectGrid, EmptyState } from '@/components/projects/project-grid';
import { ConfirmDeleteModal } from '@/components/projects/confirm-delete-modal';
import { IconPlus } from '@/components/projects/project-card';

const ACCENT = '#f97316';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectCard | null>(null);
  const { activeProjectId, setActiveProjectId } = useProjectStore();
  const { data: allTasks, isLoading: tasksLoading } = useAllTasks();

  // Load projects on mount
  useEffect(() => {
    listProjects()
      .then(p => setProjects(p))
      .finally(() => setProjectsLoading(false));
  }, []);

  // Sync preferences with server (cross-device persistence)
  useServerPreferences();

  const cards = useMemo<ProjectCard[]>(() => {
    return projects.map(project => {
      const tasks = (allTasks ?? [])
        .filter(t => t.project_id === project.id)
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
      return {
        project,
        tasks,
        activeCount: tasks.filter(t => t.status === 'RUNNING').length,
        lastActivity: tasks[0]?.created_at ?? project.created_at ?? null,
        latestGoal: tasks[0]?.goal ?? null,
      };
    });
  }, [projects, allTasks]);

  const {
    search, setSearch,
    statusFilter, setStatusFilter,
    accessFilter, setAccessFilter,
    buildTypeFilter, setBuildTypeFilter,
    viewMode, setViewMode,
    groupBy, setGroupBy,
    filteredCards,
    clearFilters,
    activeFiltersCount,
  } = useProjectFilters(cards, activeProjectId);

  const handleDelete = useCallback(async (card: ProjectCard) => {
    setDeletingId(card.project.id);
    setConfirmDelete(null);
    try {
      const taskIds = card.tasks.map(t => t.id);
      await deleteProject(card.project.id, taskIds);
      deleteReportsByProject(card.project.id);
      if (activeProjectId === card.project.id) setActiveProjectId(null);
      const updated = await listProjects();
      setProjects(updated);
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDeletingId(null);
    }
  }, [activeProjectId, setActiveProjectId]);

  const loading = projectsLoading && tasksLoading;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.3; } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '2.5rem 2.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        .project-card-wrap:hover .delete-btn { opacity: 1 !important; }
      `}</style>

      {/* Confirmation modal */}
      {confirmDelete && (
        <ConfirmDeleteModal
          confirmDelete={confirmDelete}
          deletingId={deletingId}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
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

      {/* Toolbar */}
      <FilterControls
        search={search} setSearch={setSearch}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        accessFilter={accessFilter} setAccessFilter={setAccessFilter}
        buildTypeFilter={buildTypeFilter} setBuildTypeFilter={setBuildTypeFilter}
        viewMode={viewMode} setViewMode={setViewMode}
        groupBy={groupBy} setGroupBy={setGroupBy}
        activeFiltersCount={activeFiltersCount}
        clearFilters={clearFilters}
      />

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
          viewMode={viewMode}
          groupBy={groupBy}
          activeProjectId={activeProjectId}
          onActivate={(card) => setActiveProjectId(card.project.id)}
          onDelete={(card) => setConfirmDelete(card)}
        />
      )}
    </div>
  );
}
