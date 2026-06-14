'use client';

import { useState, useEffect, useRef, type MouseEvent } from 'react';
import { ChibiAvatar, BUILDER_RING_COLORS, type SwarmRole } from '@/components/chibi-avatar';
import type { AgentFileEntry } from '@/components/swarm-view';

export interface TreeNode {
  name: string;
  relPath: string;
  type: 'file' | 'dir';
  children: TreeNode[];
}

export function buildTree(files: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const file of files) {
    const parts = file.split('/');
    let level = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const relPath = parts.slice(0, i + 1).join('/');
      const isFile = i === parts.length - 1;
      let node = level.find(n => n.name === name);
      if (!node) {
        node = { name, relPath, type: isFile ? 'file' : 'dir', children: [] };
        level.push(node);
      }
      if (!isFile) level = node.children;
    }
  }
  return root;
}

const EXT_COLOR: Record<string, string> = {
  ts: '#3b82f6', tsx: '#06b6d4', js: '#eab308', jsx: '#f97316',
  css: '#a855f7', html: '#ef4444', json: '#10b981',
  py: '#f59e0b', md: '#6b7280', yaml: '#6366f1', yml: '#6366f1',
  sh: '#22c55e', env: '#f59e0b', gitignore: '#6b7280',
  svg: '#ec4899', png: '#ec4899', jpg: '#ec4899',
};

export function extColor(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_COLOR[ext] ?? 'var(--text-secondary)';
}

export function FileIcon({ name }: { name: string }) {
  const color = extColor(name);
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6,
      borderRadius: '50%', background: color, flexShrink: 0, marginTop: 1,
    }} />
  );
}

export function AgentBadge({ entry, size, pulse }: { entry: AgentFileEntry; size: number; pulse: boolean }) {
  const ringColor = entry.role === 'builder'
    ? BUILDER_RING_COLORS[entry.builderIdx % BUILDER_RING_COLORS.length]
    : 'transparent';
  return (
    <div style={{
      flexShrink: 0,
      borderRadius: '50%',
      padding: entry.role === 'builder' ? '2px' : 0,
      background: entry.role === 'builder'
        ? (pulse ? ringColor : `color-mix(in srgb, ${ringColor} 40%, var(--surface))`)
        : 'transparent',
      animation: pulse ? 'writePulse 1.2s ease-in-out infinite' : undefined,
      opacity: pulse ? 1 : 0.4,
      filter: pulse ? 'none' : 'grayscale(0.7)',
      transition: 'opacity 0.4s, filter 0.4s',
    }}>
      <ChibiAvatar role={entry.role as SwarmRole} size={size} />
    </div>
  );
}

export function TreeItem({
  node, depth, selected, activeFiles, agentOnFile, onSelect, defaultOpen, onContextMenu,
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  activeFiles: Set<string>;
  agentOnFile: Map<string, AgentFileEntry>;
  onSelect: (relPath: string) => void;
  defaultOpen: boolean;
  onContextMenu?: (e: MouseEvent, relPath: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen || depth < 2);

  if (node.type === 'dir') {
    return (
      <div>
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.2rem 0.5rem', paddingLeft: `${0.5 + depth * 0.875}rem`,
            cursor: 'pointer', borderRadius: '4px', userSelect: 'none',
            fontSize: '0.78rem', color: 'var(--text-secondary)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-raised)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
        >
          <span style={{ fontSize: '0.6rem', opacity: 0.5, width: 10, textAlign: 'center' }}>
            {open ? '▼' : '▶'}
          </span>
          <span style={{ fontWeight: 500 }}>{node.name}</span>
        </div>
        {open && node.children.map(child => (
          <TreeItem key={child.relPath} node={child} depth={depth + 1}
            selected={selected} activeFiles={activeFiles} agentOnFile={agentOnFile}
            onSelect={onSelect} defaultOpen={false} onContextMenu={onContextMenu} />
        ))}
      </div>
    );
  }

  const isSelected = selected === node.relPath;
  const isActive = activeFiles.has(node.relPath);
  const entry = agentOnFile.get(node.relPath);
  const ringColor = entry?.role === 'builder'
    ? BUILDER_RING_COLORS[entry.builderIdx % BUILDER_RING_COLORS.length]
    : null;

  const firstSeenRef = useRef<boolean>(false);
  const [isNew, setIsNew] = useState(false);
  useEffect(() => {
    if (!firstSeenRef.current) {
      firstSeenRef.current = true;
      if (isActive && entry) {
        setIsNew(true);
        const t = setTimeout(() => setIsNew(false), 900);
        return () => clearTimeout(t);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const prevActiveRef = useRef(isActive);
  useEffect(() => {
    if (!prevActiveRef.current && isActive && entry) {
      setIsNew(true);
      const t = setTimeout(() => setIsNew(false), 900);
      prevActiveRef.current = isActive;
      return () => clearTimeout(t);
    }
    prevActiveRef.current = isActive;
  }, [isActive, entry]);

  return (
    <div
      onClick={() => onSelect(node.relPath)}
      onContextMenu={e => onContextMenu?.(e, node.relPath)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.2rem 0.5rem', paddingLeft: `${0.5 + depth * 0.875}rem`,
        cursor: 'pointer', borderRadius: '4px', userSelect: 'none',
        fontSize: '0.78rem',
        background: isNew && ringColor
          ? `color-mix(in srgb, ${ringColor} 18%, transparent)`
          : isSelected
          ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
          : isActive && ringColor
          ? `color-mix(in srgb, ${ringColor} 8%, transparent)`
          : 'transparent',
        color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
        fontWeight: isSelected ? 600 : 400,
        transition: isNew ? 'background 0.8s ease-out' : 'background 0.1s',
        borderLeft: isActive && ringColor ? `2px solid ${ringColor}60` : '2px solid transparent',
      }}
      onMouseEnter={e => { if (!isSelected && !isNew) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-raised)'; }}
      onMouseLeave={e => {
        if (!isSelected && !isNew) {
          (e.currentTarget as HTMLDivElement).style.background =
            isActive && ringColor ? `color-mix(in srgb, ${ringColor} 8%, transparent)` : 'transparent';
        }
      }}
    >
      <FileIcon name={node.name} />
      <style>{`@keyframes writePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.name}
      </span>
      {entry && <AgentBadge entry={entry} size={16} pulse={isActive} />}
    </div>
  );
}
