'use client';

import { useEffect, useState } from 'react';

interface TraceRecord {
  ts: string;
  agent: string;
  turn: number;
  tool: string | null;
  input: string;
  result: string;
  tokens: { input: number; output: number };
  latency_ms: number;
  reasoning: string;
}

const AGENT_TRACE_COLORS: Record<string, string> = {
  pm:        '#a78bfa',
  architect: '#60a5fa',
  builder:   '#34d399',
  inspector: '#fbbf24',
  security:  '#f87171',
  devops:    '#fb923c',
  foreman:   '#94a3b8',
};

function agentColor(agent: string): string {
  const key = agent.toLowerCase().split(/[\s_-]/)[0];
  return AGENT_TRACE_COLORS[key] ?? '#94a3b8';
}

function Spinner() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth={2} strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export function TracesPanel({ taskId, repoPath }: { taskId: string; repoPath: string }) {
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({ task_id: taskId });
        if (repoPath) params.set('repo_path', repoPath);
        const res = await fetch(`/api/traces?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setTraces(data);
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [taskId, repoPath]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2.5rem' }}>
        <Spinner />
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '0.5rem', padding: '2rem',
        color: 'var(--text-secondary)', fontSize: '0.8rem', opacity: 0.6,
      }}>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
        </svg>
        <span>No traces yet</span>
        <span style={{ fontSize: '0.72rem', textAlign: 'center', maxWidth: 200 }}>
          Decision traces appear here as agents run
        </span>
      </div>
    );
  }

  const agentStats = traces.reduce<Record<string, { turns: number; tokens: number }>>((acc, t) => {
    const key = t.agent;
    if (!acc[key]) acc[key] = { turns: 0, tokens: 0 };
    acc[key].turns++;
    acc[key].tokens += (t.tokens?.input ?? 0) + (t.tokens?.output ?? 0);
    return acc;
  }, {});

  const totalTokens = traces.reduce((s, t) => s + (t.tokens?.input ?? 0) + (t.tokens?.output ?? 0), 0);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.375rem',
        padding: '0.5rem 0.75rem',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '8px', fontSize: '0.72rem',
      }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: '0.25rem' }}>
          {traces.length} decisions
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>·</span>
        <span style={{ color: 'var(--text-secondary)' }}>{totalTokens.toLocaleString()} tokens</span>
        {Object.entries(agentStats).map(([agent, stats]) => (
          <span key={agent} style={{
            padding: '0.1rem 0.4rem', borderRadius: '4px',
            background: `${agentColor(agent)}20`,
            border: `1px solid ${agentColor(agent)}40`,
            color: agentColor(agent), fontWeight: 600,
          }}>
            {agent.split(/[\s_]/)[0]}: {stats.turns}t
          </span>
        ))}
      </div>

      {traces.map((trace, idx) => {
        const color = agentColor(trace.agent);
        const isOpen = expanded === idx;
        const time = new Date(trace.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        return (
          <div
            key={idx}
            style={{
              border: `1px solid ${isOpen ? color + '60' : 'var(--border)'}`,
              borderLeft: `3px solid ${color}`,
              borderRadius: '8px',
              overflow: 'hidden',
              transition: 'border-color 0.15s',
            }}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : idx)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.625rem',
                background: isOpen ? `${color}10` : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.15s',
              }}
            >
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.35rem',
                borderRadius: '4px', background: `${color}20`, color,
                flexShrink: 0, fontFamily: 'monospace',
              }}>
                {trace.agent.split(/[\s_]/)[0].toUpperCase()}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                t{trace.turn}
              </span>
              {trace.tool && (
                <span style={{
                  fontSize: '0.72rem', fontFamily: 'monospace',
                  color: 'var(--text-primary)', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {trace.tool}
                </span>
              )}
              {(trace.tokens?.input || trace.tokens?.output) ? (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {((trace.tokens.input + trace.tokens.output) / 1000).toFixed(1)}k
                </span>
              ) : null}
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                {time}
              </span>
              <svg
                width={12} height={12} viewBox="0 0 24 24" fill="none"
                stroke="var(--text-secondary)" strokeWidth={2.5} strokeLinecap="round"
                style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {isOpen && (
              <div style={{
                padding: '0.625rem 0.875rem',
                borderTop: `1px solid ${color}30`,
                background: `${color}06`,
                display: 'flex', flexDirection: 'column', gap: '0.5rem',
              }}>
                {trace.reasoning && (
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.2rem' }}>Reasoning</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{trace.reasoning}</p>
                  </div>
                )}
                {trace.input && (
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.2rem' }}>Input</p>
                    <pre style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>{trace.input}</pre>
                  </div>
                )}
                {trace.result && (
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.2rem' }}>Result</p>
                    <pre style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>{trace.result}</pre>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                  <span>↑ {trace.tokens?.input ?? 0} in</span>
                  <span>↓ {trace.tokens?.output ?? 0} out</span>
                  {trace.latency_ms > 0 && <span>⏱ {trace.latency_ms}ms</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
