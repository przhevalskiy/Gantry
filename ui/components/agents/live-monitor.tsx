'use client';

import { buildAgentTree, type AgentNode } from '@/lib/parse-agent-messages';
import { getAllReports } from '@/lib/report-store';
import { useTaskMessages } from '@/hooks/use-task-messages';
import { useState } from 'react';

const ROLE_COLOR: Record<string, string> = {
  Orchestrator: '#6366f1',
  Scout: '#0ea5e9',
  Agent: '#8b5cf6',
  Critic: '#f59e0b',
  Verifier: '#ef4444',
  Executor: '#16a34a',
};

const STATUS_COLOR = {
  running: '#d97706',
  done: '#16a34a',
  failed: '#dc2626',
};

function AgentNodeRow({ node }: { node: AgentNode }) {
  const color = ROLE_COLOR[node.role] ?? '#888';
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      padding: '0.625rem 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        color,
        background: color + '15',
        padding: '0.15rem 0.5rem',
        borderRadius: '999px',
        flexShrink: 0,
        marginTop: 2,
      }}>
        {node.id}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '0.825rem',
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {node.lastAction}
        </p>
      </div>
      <span style={{
        fontSize: '0.7rem',
        fontWeight: 500,
        color: STATUS_COLOR[node.status],
        flexShrink: 0,
      }}>
        {node.status}
      </span>
    </div>
  );
}

function TaskMonitor({ taskId, query }: { taskId: string; query: string }) {
  const { data: messages = [] } = useTaskMessages(taskId);
  const nodes = buildAgentTree(messages as { content: string }[]);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      overflow: 'hidden',
      marginBottom: '1rem',
    }}>
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
          {query}
        </p>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
          {taskId.slice(0, 8)}...
        </span>
      </div>
      <div style={{ padding: '0 1rem' }}>
        {nodes.length === 0 ? (
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', padding: '0.75rem 0', opacity: 0.6 }}>
            No agent activity yet — messages surface once agents start reporting.
          </p>
        ) : (
          nodes.map(n => <AgentNodeRow key={n.id} node={n} />)
        )}
      </div>
    </div>
  );
}

export function LiveMonitor() {
  const reports = getAllReports().slice(0, 5); // Monitor last 5 tasks

  if (reports.length === 0) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '2.5rem 2rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.375rem' }}>
            Live Monitor
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Real-time agent activity across running tasks.
          </p>
        </div>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '3rem 2rem',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            No tasks yet
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
            Start a research or execution task to see the agent ecosystem in action.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2.5rem 2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Live Monitor
          </h1>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#d97706',
            background: '#d9770615',
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
          }}>
            Pending Bug 1.1
          </span>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Agent tags will populate once child workflow messages are fixed. Tree structure is ready.
        </p>
      </div>

      {reports.map(r => (
        <TaskMonitor key={r.taskId} taskId={r.taskId} query={r.query} />
      ))}
    </div>
  );
}
