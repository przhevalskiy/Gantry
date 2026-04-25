'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TaskMessage } from 'agentex/resources';

const CONTEXT_WINDOW = 200_000;
const CHARS_PER_TOKEN = 4;

const PRICING: Record<string, { input: number; output: number; label: string }> = {
  sonnet:  { input: 3.00,  output: 15.00, label: 'Sonnet' },
  haiku:   { input: 0.25,  output: 1.25,  label: 'Haiku'  },
  mistral: { input: 2.00,  output: 6.00,  label: 'Mistral' },
};

const AGENT_TURN_ESTIMATES: Record<string, number> = {
  builder:   20,
  architect: 8,
  inspector: 10,
  security:  8,
  devops:    6,
  pm:        6,
  foreman:   2,
};

const SYSTEM_OVERHEAD_PER_TURN: Record<string, number> = {
  builder:   2500,
  architect: 2000,
  inspector: 2000,
  security:  1800,
  devops:    1800,
  pm:        1500,
  foreman:   500,
};

const HEAL_CYCLE_COST_USD = 0.38;

interface AgentTokens { agent: string; tokens: number; color: string }

const AGENT_COLORS: Record<string, string> = {
  foreman:   '#f97316',
  pm:        '#8b5cf6',
  architect: '#3b82f6',
  builder:   '#10b981',
  inspector: '#f59e0b',
  security:  '#ef4444',
  devops:    '#fb923c',
};

function agentTokenColor(agent: string): string {
  return AGENT_COLORS[agent.toLowerCase()] ?? '#94a3b8';
}

function estimateCost(
  byAgent: AgentTokens[],
  total: number,
  healCycles: number,
  builderCount: number,
): {
  sonnetCost: number;
  haikuCost: number;
  overheadCost: number;
  healCost: number;
  totalCost: number;
  breakdown: { label: string; cost: number; model: string }[];
} {
  const INPUT_RATIO = 0.70;

  let sonnetTokens = 0;
  let haikuTokens = 0;
  let overheadTokens = 0;
  const breakdown: { label: string; cost: number; model: string }[] = [];

  for (const { agent, tokens } of byAgent) {
    const key = agent.toLowerCase();
    const totalTurns = AGENT_TURN_ESTIMATES[key] ?? 10;
    const sonnetTurnFraction = Math.min(1, 4 / totalTurns);
    const agentSonnet = Math.round(tokens * sonnetTurnFraction);
    const agentHaiku = tokens - agentSonnet;

    sonnetTokens += agentSonnet;
    haikuTokens += agentHaiku;

    const overhead = (SYSTEM_OVERHEAD_PER_TURN[key] ?? 1500) * totalTurns;
    overheadTokens += overhead;

    const sonnetCost = (agentSonnet * INPUT_RATIO / 1_000_000) * PRICING.sonnet.input
      + (agentSonnet * (1 - INPUT_RATIO) / 1_000_000) * PRICING.sonnet.output;
    const haikuCost = (agentHaiku * INPUT_RATIO / 1_000_000) * PRICING.haiku.input
      + (agentHaiku * (1 - INPUT_RATIO) / 1_000_000) * PRICING.haiku.output;
    const agentCost = sonnetCost + haikuCost;

    if (agentCost > 0.0001) {
      breakdown.push({ label: agent, cost: agentCost, model: sonnetTurnFraction > 0.5 ? 'Sonnet' : 'Hybrid' });
    }
  }

  const sonnetCost = (sonnetTokens * INPUT_RATIO / 1_000_000) * PRICING.sonnet.input
    + (sonnetTokens * (1 - INPUT_RATIO) / 1_000_000) * PRICING.sonnet.output;
  const haikuCost = (haikuTokens * INPUT_RATIO / 1_000_000) * PRICING.haiku.input
    + (haikuTokens * (1 - INPUT_RATIO) / 1_000_000) * PRICING.haiku.output;
  const overheadCost = (overheadTokens / 1_000_000) * PRICING.sonnet.input;
  const healCost = healCycles * HEAL_CYCLE_COST_USD;

  return {
    sonnetCost,
    haikuCost,
    overheadCost,
    healCost,
    totalCost: sonnetCost + haikuCost + overheadCost + healCost,
    breakdown: breakdown.sort((a, b) => b.cost - a.cost),
  };
}

function formatCost(usd: number): string {
  if (usd < 0.001) return '<$0.001';
  if (usd < 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

function estimateTokens(messages: TaskMessage[]): {
  total: number;
  byAgent: AgentTokens[];
  healCycles: number;
  builderCount: number;
} {
  const agentMap = new Map<string, number>();
  let total = 0;
  let healCycles = 0;
  const builderTracks = new Set<string>();

  for (const msg of messages) {
    const c = msg.content as { type?: string; content?: unknown } | null | undefined;
    const text = (c?.type === 'text' || !c?.type) && typeof c?.content === 'string' ? c.content : '';
    if (!text) continue;

    const chars = text.length;
    const tokens = Math.round(chars / CHARS_PER_TOKEN);
    total += tokens;

    const m = text.match(/^\[([A-Za-z]+)/);
    const agent = m ? m[1].toLowerCase() : 'system';
    agentMap.set(agent, (agentMap.get(agent) ?? 0) + tokens);

    if (/heal cycle \d+/i.test(text) || /dispatching builder \(heal/i.test(text)) {
      const hm = text.match(/heal cycle (\d+)/i);
      if (hm) healCycles = Math.max(healCycles, parseInt(hm[1], 10));
      else healCycles = Math.max(healCycles, 1);
    }

    const bm = text.match(/^\[Builder(?:\s+\(([^)]+)\))?\]/i);
    if (bm) builderTracks.add(bm[1] ?? 'main');
  }

  const byAgent: AgentTokens[] = Array.from(agentMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([agent, tokens]) => ({
      agent: agent.charAt(0).toUpperCase() + agent.slice(1),
      tokens,
      color: agentTokenColor(agent),
    }));

  return { total, byAgent, healCycles, builderCount: Math.max(1, builderTracks.size) };
}

export function ContextUsageIndicator({ messages, taskId, repoPath }: { messages: TaskMessage[]; taskId: string; repoPath: string }) {
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ bottom: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const { total, byAgent, healCycles, builderCount } = useMemo(() => estimateTokens(messages), [messages]);
  const pct = Math.min(100, Math.round((total / CONTEXT_WINDOW) * 100));
  const { sonnetCost, haikuCost, overheadCost, healCost, totalCost, breakdown } = useMemo(
    () => estimateCost(byAgent, total, healCycles, builderCount),
    [byAgent, total, healCycles, builderCount]
  );

  const [realTokens, setRealTokens] = useState<{ input: number; output: number } | null>(null);
  useEffect(() => {
    if (!taskId) return;
    const params = new URLSearchParams({ task_id: taskId });
    if (repoPath) params.set('repo_path', repoPath);
    fetch(`/api/traces?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: Array<{ tokens?: { input: number; output: number } }> | null) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const totalIn = data.reduce((s, t) => s + (t.tokens?.input ?? 0), 0);
        const totalOut = data.reduce((s, t) => s + (t.tokens?.output ?? 0), 0);
        if (totalIn + totalOut > 0) setRealTokens({ input: totalIn, output: totalOut });
      })
      .catch(() => {});
  }, [taskId, repoPath, messages.length]);

  const displayTotal = realTokens ? realTokens.input + realTokens.output : total;
  const pctDisplay = Math.min(100, Math.round((displayTotal / CONTEXT_WINDOW) * 100));
  const barColor = pctDisplay >= 80 ? 'var(--error)' : pctDisplay >= 50 ? 'var(--warning)' : 'var(--success)';

  function openPopover() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPopoverPos({
      bottom: window.innerHeight - rect.top + 8,
      left: rect.left + rect.width / 2,
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  if (messages.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => open ? setOpen(false) : openPopover()}
        title="Context usage"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0.25rem 0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
          borderRadius: '5px', opacity: open ? 1 : 0.55, flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.opacity = '0.55'; }}
      >
        <div style={{
          width: 28, height: 4, borderRadius: 999,
          background: 'var(--surface-raised)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            width: `${pctDisplay}%`, height: '100%',
            background: barColor,
            borderRadius: 999,
            transition: 'width 0.3s',
          }} />
        </div>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {pctDisplay}%
        </span>
      </button>

      {open && popoverPos && (
        <div
          ref={ref}
          style={{
            position: 'fixed',
            bottom: popoverPos.bottom,
            left: popoverPos.left,
            transform: 'translateX(-50%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '0.875rem 1rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 9999,
            minWidth: '220px',
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
          }}
        >
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.125rem' }}>
              Context usage
            </p>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', margin: 0, opacity: 0.6 }}>
              {realTokens
                ? `${(realTokens.input + realTokens.output).toLocaleString()} tokens (real) / ${(CONTEXT_WINDOW / 1000).toFixed(0)}k window`
                : `~${total.toLocaleString()} / ${(CONTEXT_WINDOW / 1000).toFixed(0)}k tokens estimated`}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div style={{
              height: 6, borderRadius: 999,
              background: 'var(--surface-raised)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${pctDisplay}%`, height: '100%',
                background: barColor, borderRadius: 999,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.68rem', color: barColor, fontWeight: 600 }}>{pctDisplay}% used</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.5 }}>
                ~{Math.round((CONTEXT_WINDOW - displayTotal) / 1000)}k remaining
              </span>
            </div>
          </div>

          {byAgent.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', opacity: 0.5, margin: 0 }}>
                By agent
              </p>
              {byAgent.slice(0, 6).map(({ agent, tokens, color }) => (
                <div key={agent} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', flex: 1 }}>{agent}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    ~{tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens}
                  </span>
                  <div style={{ width: 40, height: 3, borderRadius: 999, background: 'var(--surface-raised)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((tokens / total) * 100)}%`, height: '100%', background: color, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalCost > 0 && (
            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '0.625rem',
              display: 'flex', flexDirection: 'column', gap: '0.35rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', opacity: 0.5, margin: 0 }}>
                  Estimated cost
                </p>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCost(totalCost)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {sonnetCost > 0.0001 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Sonnet (planning turns)</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatCost(sonnetCost)}</span>
                  </div>
                )}
                {haikuCost > 0.0001 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Haiku (execution turns)</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatCost(haikuCost)}</span>
                  </div>
                )}
                {overheadCost > 0.001 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>System prompts + tools</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{formatCost(overheadCost)}</span>
                  </div>
                )}
                {healCycles > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--warning)' }}>
                      {healCycles} heal cycle{healCycles !== 1 ? 's' : ''} × {builderCount} track{builderCount !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--warning)', fontVariantNumeric: 'tabular-nums' }}>{formatCost(healCost)}</span>
                  </div>
                )}
              </div>
              {breakdown.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.15rem' }}>
                  {breakdown.slice(0, 5).map(({ label, cost, model }) => {
                    const color = agentTokenColor(label.toLowerCase());
                    return (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.5 }}>{model}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCost(cost)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.4, margin: 0 }}>
            Includes system prompts, tool schemas{healCycles > 0 ? `, and ${healCycles} heal cycle${healCycles !== 1 ? 's' : ''}` : ''}. Prompt caching may reduce actual cost.
          </p>
        </div>
      )}
    </>
  );
}
