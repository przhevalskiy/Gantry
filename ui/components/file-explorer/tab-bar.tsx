'use client';

import { type RefObject, type MouseEvent } from 'react';
import { extColor, AgentBadge } from './file-tree';
import type { Tab } from '@/hooks/use-file-tabs';
import type { AgentFileEntry } from '@/components/swarm-view';

interface ContextMenuState {
  x: number;
  y: number;
  relPath: string;
}

export function TabBar({
  tabs,
  activeTab,
  agentOnFile,
  isRunning,
  recentRel,
  onTabClick,
  onCloseTab,
}: {
  tabs: Tab[];
  activeTab: string | null;
  agentOnFile: Map<string, AgentFileEntry>;
  isRunning: boolean;
  recentRel: Set<string>;
  onTabClick: (relPath: string) => void;
  onCloseTab: (relPath: string, e: MouseEvent) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', overflowX: 'auto', flexShrink: 0,
      borderBottom: '1px solid var(--border)', background: 'var(--background)',
      scrollbarWidth: 'none',
    }}>
      {tabs.map(tab => {
        const fileName = tab.relPath.split('/').pop() ?? tab.relPath;
        const color = extColor(fileName);
        const isActive = tab.relPath === activeTab;
        const isDirty = isRunning && recentRel.has(tab.relPath);
        return (
          <div
            key={tab.relPath}
            onClick={() => onTabClick(tab.relPath)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0 0.75rem', height: '36px', flexShrink: 0,
              cursor: 'pointer', userSelect: 'none',
              borderRight: '1px solid var(--border)',
              borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
              background: isActive ? 'var(--surface)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-raised)'; }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', fontWeight: isActive ? 600 : 400, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
              {fileName}
            </span>
            {agentOnFile.get(tab.relPath) && (
              <AgentBadge entry={agentOnFile.get(tab.relPath)!} size={14} pulse={isDirty} />
            )}
            <span
              onClick={(e) => onCloseTab(tab.relPath, e)}
              style={{
                marginLeft: '0.15rem', width: 16, height: 16, display: 'flex',
                alignItems: 'center', justifyContent: 'center', borderRadius: '3px',
                fontSize: '0.7rem', color: 'var(--text-secondary)', flexShrink: 0,
                opacity: 0.5,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.opacity = '1'; (e.currentTarget as HTMLSpanElement).style.background = 'var(--surface-raised)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.opacity = '0.5'; (e.currentTarget as HTMLSpanElement).style.background = 'transparent'; }}
            >
              ✕
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ContextMenu({
  ctxMenu,
  ctxMenuRef,
  onOpenTab,
  onCopyRelPath,
  onCopyPath,
  onCopyContent,
}: {
  ctxMenu: ContextMenuState;
  ctxMenuRef: RefObject<HTMLDivElement>;
  onOpenTab: () => void;
  onCopyRelPath: () => void;
  onCopyPath: () => void;
  onCopyContent: () => void;
}) {
  return (
    <div
      ref={ctxMenuRef}
      style={{
        position: 'fixed',
        top: ctxMenu.y,
        left: ctxMenu.x,
        zIndex: 1000,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        minWidth: '180px',
      }}
    >
      {[
        { label: 'Open in tab', icon: '↗', action: onOpenTab },
        { label: 'Copy relative path', icon: '📋', action: onCopyRelPath },
        { label: 'Copy absolute path', icon: '📁', action: onCopyPath },
        { label: 'Copy file content', icon: '📄', action: onCopyContent },
      ].map(({ label, icon, action }) => (
        <button
          key={label}
          onClick={action}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            width: '100%', padding: '0.55rem 0.875rem',
            background: 'transparent', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
            fontSize: '0.8rem', color: 'var(--text-primary)', textAlign: 'left',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <span style={{ fontSize: '0.75rem', opacity: 0.6, width: 16 }}>{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
