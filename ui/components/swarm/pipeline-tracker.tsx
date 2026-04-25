'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChibiAvatar, BUILDER_RING_COLORS, type SwarmRole } from '../chibi-avatar';
import type { PipelineStage } from './utils';

function PulsingDot() {
  return (
    <>
      <style>{`@keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }`}</style>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: 'var(--accent)', display: 'inline-block',
        animation: 'pulseDot 1.2s ease-in-out infinite',
        flexShrink: 0,
      }} />
    </>
  );
}

export function PipelineTracker({ stages, messages }: { stages: PipelineStage[]; messages: { content: unknown }[] }) {
  const trackLastAction = useMemo(() => {
    const map = new Map<string, string>();
    const BUILDER_ACTION_RE = /^\[Builder(?:\s+\(([^)]+)\))?\]\s*([a-z_]+):\s*(.+)/i;
    for (const msg of messages) {
      const c = msg.content as { type?: string; content?: unknown } | null | undefined;
      const text = (c?.type === 'text' || !c?.type) && typeof c?.content === 'string' ? c.content : '';
      const m = text.match(BUILDER_ACTION_RE);
      if (m) {
        const track = m[1] ?? 'main';
        const tool = m[2].toLowerCase();
        const detail = m[3].trim();
        const filename = detail.split('/').pop() ?? detail;
        const label = tool === 'write_file' ? `Writing ${filename}`
          : tool === 'patch_file' ? `Patching ${filename}`
          : tool === 'read_file' ? `Reading ${filename}`
          : tool === 'verify_build' ? 'Verifying build…'
          : tool === 'finish_build' ? '✓ Done'
          : `${tool}: ${filename}`;
        map.set(track, label);
      }
    }
    return map;
  }, [messages]);

  const prevActiveRef = useRef<string | null>(null);
  const [animatingConnector, setAnimatingConnector] = useState<string | null>(null);

  useEffect(() => {
    const currentActive = stages.find(s => s.state === 'active')?.key ?? null;
    if (currentActive && currentActive !== prevActiveRef.current) {
      setAnimatingConnector(currentActive);
      const t = setTimeout(() => setAnimatingConnector(null), 800);
      prevActiveRef.current = currentActive;
      return () => clearTimeout(t);
    }
  }, [stages]);

  return (
    <>
      <style>{`
        @keyframes connectorFlow {
          0%   { top: 0; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {stages.map((stage, stageIdx) => {
          const isActive = stage.state === 'active';
          const isDone = stage.state === 'done';
          const isPending = stage.state === 'pending';
          const isAnimating = animatingConnector === stage.key;

          let borderColor = 'var(--border)';
          let bg = 'var(--surface-raised)';
          let labelColor = 'var(--text-secondary)';
          const opacity = isPending ? 0.4 : 1;

          if (isActive) {
            borderColor = 'var(--accent)';
            bg = 'color-mix(in srgb, var(--accent) 8%, transparent)';
            labelColor = 'var(--accent)';
          } else if (isDone) {
            borderColor = 'color-mix(in srgb, var(--success) 30%, transparent)';
            labelColor = 'var(--success)';
          } else if (stage.state === 'failed') {
            borderColor = 'color-mix(in srgb, var(--error) 30%, transparent)';
            labelColor = 'var(--error)';
          }

          const isBuilderWithTracks = stage.key === 'builder' && stage.subtracks && stage.subtracks.length > 1;

          return (
            <div key={stage.key} style={{ display: 'flex', flexDirection: 'column' }}>
              {stageIdx > 0 && (
                <div style={{
                  width: 2, height: 20, background: 'var(--border)',
                  margin: '0 auto', position: 'relative', overflow: 'hidden',
                  borderRadius: 1,
                }}>
                  {isAnimating && (
                    <div style={{
                      position: 'absolute', left: 0, right: 0, height: 8,
                      background: 'var(--accent)',
                      borderRadius: 1,
                      animation: 'connectorFlow 0.7s ease-in-out forwards',
                    }} />
                  )}
                  {isDone && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'color-mix(in srgb, var(--success) 50%, transparent)',
                    }} />
                  )}
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.625rem 0.875rem',
                background: bg,
                border: `1px solid ${borderColor}`,
                borderRadius: isBuilderWithTracks ? '10px 10px 0 0' : '10px',
                opacity,
                transition: 'all 0.2s ease',
              }}>
                <ChibiAvatar role={stage.key as SwarmRole} size={28} />
                <span style={{ fontSize: '0.875rem', fontWeight: isActive ? 600 : 500, color: labelColor, flex: 1 }}>
                  {stage.label}
                </span>
                {isActive && <PulsingDot />}
                {isDone && <span style={{ color: 'var(--success)', fontSize: '0.8rem' }}>✓</span>}
                {stage.state === 'failed' && <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>✗</span>}
              </div>

              {isBuilderWithTracks && (
                <div style={{
                  border: `1px solid ${borderColor}`,
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                  overflow: 'hidden',
                  opacity,
                }}>
                  {stage.subtracks!.map((track, i) => {
                    const trackColor = BUILDER_RING_COLORS[i % BUILDER_RING_COLORS.length];
                    const lastAction = trackLastAction.get(track);
                    const trackDone = isDone || lastAction === '✓ Done';
                    return (
                      <div
                        key={track}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.625rem',
                          padding: '0.5rem 0.875rem',
                          background: isActive
                            ? `color-mix(in srgb, ${trackColor} 6%, var(--surface))`
                            : 'var(--surface)',
                          borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                          borderLeft: `3px solid ${trackColor}`,
                          transition: 'background 0.2s',
                        }}
                      >
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: trackColor, flexShrink: 0,
                          animation: isActive && !trackDone ? 'pulseDot 1.2s ease-in-out infinite' : 'none',
                        }} />
                        <span style={{
                          fontSize: '0.78rem', fontWeight: 600,
                          color: trackColor, fontFamily: 'monospace',
                          minWidth: 60,
                        }}>
                          {track}
                        </span>
                        {lastAction && (
                          <span style={{
                            fontSize: '0.72rem', color: 'var(--text-secondary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            flex: 1,
                          }}>
                            {lastAction}
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
                          {trackDone
                            ? <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>✓</span>
                            : isActive
                            ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: trackColor, display: 'inline-block', animation: 'pulseDot 1.2s ease-in-out infinite' }} />
                            : null
                          }
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {stage.key === 'builder' && stage.subtracks && stage.subtracks.length === 1 && (
                <div style={{
                  border: `1px solid ${borderColor}`, borderTop: 'none',
                  borderRadius: '0 0 10px 10px', overflow: 'hidden', opacity,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                    padding: '0.4rem 0.875rem 0.4rem 2rem',
                    background: 'var(--surface)',
                    borderLeft: `3px solid ${BUILDER_RING_COLORS[0]}`,
                  }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.5 }}>⤷</span>
                    <span style={{ fontSize: '0.8rem', color: labelColor, fontFamily: 'monospace' }}>{stage.subtracks[0]}</span>
                    {isActive && <PulsingDot />}
                    {isDone && <span style={{ color: 'var(--success)', fontSize: '0.75rem', marginLeft: 'auto' }}>✓</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
