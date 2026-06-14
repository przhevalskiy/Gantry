'use client';

import type { ProjectCard } from '@/hooks/use-project-filters';

export function ConfirmDeleteModal({
  confirmDelete,
  deletingId,
  onCancel,
  onConfirm,
}: {
  confirmDelete: ProjectCard;
  deletingId: string | null;
  onCancel: () => void;
  onConfirm: (card: ProjectCard) => void;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onCancel}
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
            Delete &quot;{confirmDelete.project.name}&quot;?
          </p>
          <p style={{ fontSize: '0.8375rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0', lineHeight: 1.5 }}>
            This will permanently delete the project, all {confirmDelete.tasks.length} build record{confirmDelete.tasks.length !== 1 ? 's' : ''}, the repo directory, and terminate any running Temporal workflows. This cannot be undone.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
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
            onClick={() => onConfirm(confirmDelete)}
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
  );
}
