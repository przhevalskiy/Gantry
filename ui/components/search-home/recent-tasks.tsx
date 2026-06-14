'use client';

import Link from 'next/link';
import { useAllTasks } from '@/hooks/use-all-tasks';

export function RecentTasks() {
  const { data: allTasks } = useAllTasks();
  const activeTasks = (allTasks ?? [])
    .filter(t => t.status === 'RUNNING')
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 6);

  if (activeTasks.length === 0) return null;

  return (
    <div style={{ marginTop: '0.875rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem', justifyContent: 'center' }}>
      {activeTasks.map(t => (
        <Link
          key={t.id}
          href={`/task/${t.id}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            background: 'var(--surface)', border: '1px solid #3b82f640',
            borderRadius: '999px', padding: '0.25rem 0.75rem',
            textDecoration: 'none', maxWidth: '240px',
            transition: 'border-color 0.12s, background 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#3b82f6'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#3b82f640'; }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0,
            animation: 'chip-pulse 1.4s ease-in-out infinite',
          }} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.goal ?? t.id.slice(0, 16)}
          </span>
        </Link>
      ))}
      <style>{`@keyframes chip-pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }`}</style>
    </div>
  );
}
