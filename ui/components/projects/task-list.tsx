'use client';

import Link from 'next/link';
import { useAllTasks, type LiveTask } from '@/hooks/use-all-tasks';

const STATUS_STYLE: Record<string, { label: string; color: string; pulse: boolean }> = {
  RUNNING:     { label: 'Running',    color: '#3b82f6', pulse: true  },
  COMPLETED:   { label: 'Done',       color: '#22c55e', pulse: false },
  FAILED:      { label: 'Failed',     color: '#ef4444', pulse: false },
  TERMINATED:  { label: 'Stopped',    color: '#6b7280', pulse: false },
  CANCELED:    { label: 'Cancelled',  color: '#6b7280', pulse: false },
  TIMED_OUT:   { label: 'Timed out',  color: '#f59e0b', pulse: false },
};

function StatusDot({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, color: '#6b7280', pulse: false };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: s.color,
        flexShrink: 0,
        boxShadow: s.pulse ? `0 0 0 0 ${s.color}40` : undefined,
        animation: s.pulse ? 'taskPulse 1.4s ease-in-out infinite' : undefined,
      }} />
      <span style={{ fontSize: '0.75rem', color: s.color, fontWeight: 500 }}>{s.label}</span>
    </span>
  );
}

function TaskRow({ task }: { task: LiveTask }) {
  const age = task.created_at
    ? (() => {
        const diff = Date.now() - new Date(task.created_at).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;
        return `${Math.floor(m / 60)}h ago`;
      })()
    : null;

  return (
    <Link
      href={`/task/${task.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 0.75rem',
        borderRadius: 6,
        textDecoration: 'none',
        background: 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <StatusDot status={task.status ?? 'UNKNOWN'} />
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: '0.8125rem', color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {task.goal ?? task.id}
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
        {age}
      </span>
      <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 }}>
        {task.id.slice(0, 8)}
      </span>
    </Link>
  );
}

export function ProjectTaskList({ projectId }: { projectId: string }) {
  const { data: tasks, isLoading } = useAllTasks();

  const projectTasks = (tasks ?? [])
    .filter(t => t.project_id === projectId)
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 20);

  if (isLoading) return (
    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem 0.75rem' }}>
      Loading…
    </p>
  );

  if (projectTasks.length === 0) return (
    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem 0.75rem' }}>
      No tasks yet.
    </p>
  );

  return (
    <div>
      <style>{`
        @keyframes taskPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
          50%       { box-shadow: 0 0 0 5px rgba(59,130,246,0); }
        }
      `}</style>
      {projectTasks.map(t => <TaskRow key={t.id} task={t} />)}
    </div>
  );
}

export function AllTasksList() {
  const { data: tasks, isLoading } = useAllTasks();

  const sorted = (tasks ?? [])
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 50);

  if (isLoading) return (
    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '1rem' }}>Loading…</p>
  );

  if (sorted.length === 0) return (
    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '1rem' }}>No tasks yet.</p>
  );

  return (
    <div>
      <style>{`
        @keyframes taskPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
          50%       { box-shadow: 0 0 0 5px rgba(59,130,246,0); }
        }
      `}</style>
      {sorted.map(t => <TaskRow key={t.id} task={t} />)}
    </div>
  );
}
