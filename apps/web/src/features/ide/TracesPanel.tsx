import { useEffect, useState } from 'react';
import { Loader2, Network } from 'lucide-react';
import { gantryClient, type TraceRecord } from '@/shared/services/gantry/client';
import './TracesPanel.css';

const AGENT_TRACE_COLORS: Record<string, string> = {
  pm: '#a78bfa',
  architect: '#60a5fa',
  builder: '#34d399',
  inspector: '#fbbf24',
  security: '#f87171',
  devops: '#fb923c',
  foreman: '#94a3b8',
};

function agentColor(agent: string): string {
  const key = agent.toLowerCase().split(/[\s_-]/)[0];
  return AGENT_TRACE_COLORS[key] ?? '#94a3b8';
}

export function TracesPanel({ taskId }: { taskId: string }) {
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await gantryClient.getTaskTraces(taskId);
        if (!cancelled) setTraces(data);
      } catch {
        if (!cancelled) setTraces([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(() => { void load(); }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskId]);

  if (loading) {
    return (
      <div className="traces-panel-loading">
        <Loader2 size={20} className="spinning" />
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div className="traces-panel-empty">
        <Network size={28} strokeWidth={1.25} />
        <p>No traces yet</p>
        <span>Decision traces appear here as agents run</span>
      </div>
    );
  }

  const agentStats = traces.reduce<Record<string, { turns: number; tokens: number }>>((acc, t) => {
    if (!acc[t.agent]) acc[t.agent] = { turns: 0, tokens: 0 };
    acc[t.agent].turns++;
    acc[t.agent].tokens += (t.tokens?.input ?? 0) + (t.tokens?.output ?? 0);
    return acc;
  }, {});

  const totalTokens = traces.reduce(
    (s, t) => s + (t.tokens?.input ?? 0) + (t.tokens?.output ?? 0),
    0,
  );

  return (
    <div className="traces-panel">
      <div className="traces-summary">
        <strong>{traces.length} decisions</strong>
        <span>·</span>
        <span>{totalTokens.toLocaleString()} tokens</span>
        {Object.entries(agentStats).map(([agent, stats]) => (
          <span
            key={agent}
            className="traces-agent-chip"
            style={{
              background: `${agentColor(agent)}20`,
              borderColor: `${agentColor(agent)}40`,
              color: agentColor(agent),
            }}
          >
            {agent.split(/[\s_]/)[0]}: {stats.turns}t
          </span>
        ))}
      </div>

      {traces.map((trace, idx) => {
        const color = agentColor(trace.agent);
        const isOpen = expanded === idx;
        const time = new Date(trace.ts).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        return (
          <div
            key={idx}
            className={`traces-item ${isOpen ? 'open' : ''}`}
            style={{ borderColor: isOpen ? `${color}60` : undefined, borderLeftColor: color }}
          >
            <button
              type="button"
              className="traces-item-header"
              style={{ background: isOpen ? `${color}10` : undefined }}
              onClick={() => setExpanded(isOpen ? null : idx)}
            >
              <span className="traces-agent-badge" style={{ background: `${color}20`, color }}>
                {trace.agent.split(/[\s_]/)[0].toUpperCase()}
              </span>
              <span className="traces-turn">t{trace.turn}</span>
              {trace.tool && <span className="traces-tool">{trace.tool}</span>}
              {(trace.tokens?.input || trace.tokens?.output) ? (
                <span className="traces-tokens">
                  {((trace.tokens.input + trace.tokens.output) / 1000).toFixed(1)}k
                </span>
              ) : null}
              <span className="traces-time">{time}</span>
            </button>

            {isOpen && (
              <div className="traces-item-body" style={{ borderTopColor: `${color}30`, background: `${color}06` }}>
                {trace.reasoning && (
                  <div>
                    <p className="traces-section-label">Reasoning</p>
                    <p className="traces-section-text">{trace.reasoning}</p>
                  </div>
                )}
                {trace.input && (
                  <div>
                    <p className="traces-section-label">Input</p>
                    <pre className="traces-section-pre">{trace.input}</pre>
                  </div>
                )}
                {trace.result && (
                  <div>
                    <p className="traces-section-label">Result</p>
                    <pre className="traces-section-pre">{trace.result}</pre>
                  </div>
                )}
                <div className="traces-meta">
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
