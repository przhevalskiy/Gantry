'use client';

import { useState, useEffect, useRef, useCallback, type MouseEvent } from 'react';
import type { AgentFileEntry } from '@/components/swarm-view';
import { useFileTabs } from '@/hooks/use-file-tabs';
import { buildTree, TreeItem } from './file-tree';
import { CodeViewer } from './code-viewer';
import { TabBar, ContextMenu } from './tab-bar';

function EmptyPane({ repoRoot, isRunning }: { repoRoot: string; isRunning: boolean }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
      color: 'var(--text-secondary)', padding: '2rem',
    }}>
      {isRunning ? (
        <>
          <style>{`@keyframes spinSlow { to { transform: rotate(360deg); } }`}</style>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
            strokeLinecap="round" style={{ animation: 'spinSlow 2s linear infinite', opacity: 0.4 }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <p style={{ fontSize: '0.8rem', opacity: 0.5, textAlign: 'center' }}>
            Waiting for builders to write files…
          </p>
          <p style={{ fontSize: '0.72rem', opacity: 0.35, fontFamily: 'monospace' }}>{repoRoot}</p>
        </>
      ) : (
        <>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
            strokeLinecap="round" style={{ opacity: 0.3 }}>
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
          <p style={{ fontSize: '0.8rem', opacity: 0.4 }}>Select a file to view</p>
        </>
      )}
    </div>
  );
}

const FROZEN_META: Record<string, { icon: string; label: string; color: string }> = {
  TERMINATED: { icon: '⏹', label: 'Stopped',    color: 'var(--error)' },
  CANCELED:   { icon: '✕', label: 'Canceled',   color: 'var(--text-secondary)' },
  TIMED_OUT:  { icon: '⏱', label: 'Timed out',  color: 'var(--warning)' },
  FAILED:     { icon: '✗', label: 'Failed',      color: 'var(--error)' },
  DELETED:    { icon: '🗑', label: 'Deleted',    color: 'var(--text-secondary)' },
};

function ExplorerFrozenBanner({ status, fileCount }: { status: string; fileCount: number }) {
  const meta = FROZEN_META[status] ?? { icon: '●', label: status, color: 'var(--text-secondary)' };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.35rem 0.625rem',
      background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
      borderBottom: `1px solid color-mix(in srgb, ${meta.color} 20%, transparent)`,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: '0.72rem', flexShrink: 0 }}>{meta.icon}</span>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: meta.color, flexShrink: 0 }}>
        {meta.label}
      </span>
      {fileCount > 0 && (
        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
          · {fileCount} file{fileCount !== 1 ? 's' : ''} preserved
        </span>
      )}
    </div>
  );
}

export function FileExplorer({
  repoRoot,
  writtenPaths,
  agentOnFile = new Map(),
  isRunning,
  taskStatus = 'RUNNING',
  taskId,
  buildBranch,
  githubOwner,
  githubRepo,
}: {
  repoRoot: string;
  writtenPaths: string[];
  agentOnFile?: Map<string, AgentFileEntry>;
  isRunning: boolean;
  taskStatus?: string;
  taskId?: string;
  buildBranch?: string;
  githubOwner?: string;
  githubRepo?: string;
}) {
  const { tabs, setTabs, activeTab, setActiveTab, openTab, closeTab, fetchContent, useGithub } = useFileTabs({
    repoRoot,
    taskId,
    isRunning,
    buildBranch,
    githubOwner,
    githubRepo,
  });

  const [files, setFiles] = useState<string[]>([]);
  const [treeWidth] = useState(200);

  const recentRel = new Set(
    writtenPaths.slice(-6).map(p =>
      p.startsWith(repoRoot) ? p.slice(repoRoot.length).replace(/^\//, '') : p
    )
  );

  // Fetch/poll file tree — uses GitHub API on completed builds, FastAPI proxy otherwise
  useEffect(() => {
    if (!repoRoot || repoRoot === '.') return;
    if (useGithub) {
      fetch(`/api/github/tree?owner=${encodeURIComponent(githubOwner!)}&repo=${encodeURIComponent(githubRepo!)}&branch=${encodeURIComponent(buildBranch!)}`)
        .then(r => r.ok ? r.json() : null)
        .then((data: { files?: string[] } | null) => { if (data?.files) setFiles(data.files); })
        .catch(() => {});
      return;
    }
    const fetchTree = async () => {
      try {
        const res = await fetch(`/api/tree?root=${encodeURIComponent(repoRoot)}`);
        if (!res.ok) return;
        const data = await res.json();
        setFiles(data.files ?? []);
      } catch { /* ignore */ }
    };
    fetchTree();
    const id = setInterval(fetchTree, isRunning ? 2500 : 8000);
    return () => clearInterval(id);
  }, [repoRoot, isRunning, useGithub, buildBranch, githubOwner, githubRepo]); // eslint-disable-line

  // Track when the user manually selected a file (suppress auto-follow for 5s)
  const userSelectedAtRef = useRef<number>(0);
  const openTabUserGesture = useCallback(async (rel: string) => {
    userSelectedAtRef.current = Date.now();
    await openTab(rel);
  }, [openTab]);

  // Auto-follow: switch to the file a builder is actively editing
  const agentOnFileKey = Array.from(agentOnFile.keys()).sort().join(',');
  useEffect(() => {
    if (agentOnFile.size === 0) return;
    if (Date.now() - userSelectedAtRef.current < 5000) return;
    const builderEntry = Array.from(agentOnFile.entries()).find(([, e]) => e.role === 'builder');
    const target = builderEntry ?? Array.from(agentOnFile.entries())[0];
    if (!target) return;
    const [relPath] = target;
    openTab(relPath);
  }, [agentOnFileKey]); // eslint-disable-line

  // Auto-open most recently written file (when no agent is actively on a file)
  useEffect(() => {
    if (writtenPaths.length === 0) return;
    if (agentOnFile.size > 0) return;
    if (Date.now() - userSelectedAtRef.current < 5000) return;
    const last = writtenPaths[writtenPaths.length - 1];
    const rel = last.startsWith(repoRoot) ? last.slice(repoRoot.length).replace(/^\//, '') : last;
    openTab(rel);
  }, [writtenPaths.length]); // eslint-disable-line

  // Poll active tab content — fast when a builder is on it, slower otherwise
  useEffect(() => {
    if (!activeTab || !isRunning) return;
    const isHot = agentOnFile.has(activeTab);
    const id = setInterval(async () => {
      const content = await fetchContent(activeTab);
      if (content !== null) {
        setTabs(prev => prev.map(t => t.relPath === activeTab ? { ...t, content } : t));
      }
    }, isHot ? 800 : 2000);
    return () => clearInterval(id);
  }, [activeTab, isRunning, fetchContent, agentOnFileKey]); // eslint-disable-line

  const tree = buildTree(files);
  const activeTabData = tabs.find(t => t.relPath === activeTab) ?? null;
  const isActiveFile = isRunning && (activeTab ? recentRel.has(activeTab) : false);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; relPath: string } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    const closeKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtxMenu(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeKey);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', closeKey); };
  }, [ctxMenu]);

  function handleContextMenu(e: MouseEvent, relPath: string) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, relPath });
  }

  return (
    <div style={{
      display: 'flex', height: '100%', overflow: 'hidden',
      background: 'var(--background)',
    }}>
      {/* File tree sidebar */}
      <div style={{
        width: treeWidth, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--background)',
      }}>
        {!isRunning && taskStatus !== 'COMPLETED' && taskStatus !== 'RUNNING' && (
          <ExplorerFrozenBanner status={taskStatus} fileCount={files.length} />
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.375rem 0' }}>
          {files.length === 0 && isRunning && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.4, padding: '0.75rem', textAlign: 'center' }}>
              Building…
            </p>
          )}
          {files.length === 0 && !isRunning && taskStatus !== 'COMPLETED' && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.4, padding: '0.75rem', textAlign: 'center' }}>
              No files written
            </p>
          )}
          {tree.map(node => (
            <TreeItem
              key={node.relPath}
              node={node}
              depth={0}
              selected={activeTab}
              activeFiles={isRunning ? recentRel : new Set<string>()}
              agentOnFile={agentOnFile}
              onSelect={openTabUserGesture}
              defaultOpen={true}
              onContextMenu={handleContextMenu}
            />
          ))}
        </div>

        {files.length > 0 && (
          <div style={{ padding: '0.375rem 0.75rem', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.35, fontFamily: 'monospace' }}>
              {files.length} file{files.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Code viewer area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tabs.length > 0 ? (
          <>
            <TabBar
              tabs={tabs}
              activeTab={activeTab}
              agentOnFile={agentOnFile}
              isRunning={isRunning}
              recentRel={recentRel}
              onTabClick={(rel) => { userSelectedAtRef.current = Date.now(); setActiveTab(rel); }}
              onCloseTab={closeTab}
            />
            {activeTabData ? (
              <CodeViewer relPath={activeTabData.relPath} content={activeTabData.content} isActive={isActiveFile} />
            ) : (
              <EmptyPane repoRoot={repoRoot} isRunning={isRunning} />
            )}
          </>
        ) : (
          <EmptyPane repoRoot={repoRoot} isRunning={isRunning} />
        )}
      </div>

      {/* Context menu portal */}
      {ctxMenu && (
        <ContextMenu
          ctxMenu={ctxMenu}
          ctxMenuRef={ctxMenuRef}
          onOpenTab={() => { openTabUserGesture(ctxMenu.relPath); setCtxMenu(null); }}
          onCopyRelPath={() => { navigator.clipboard.writeText(ctxMenu.relPath); setCtxMenu(null); }}
          onCopyPath={() => { navigator.clipboard.writeText(`${repoRoot}/${ctxMenu.relPath}`); setCtxMenu(null); }}
          onCopyContent={() => {
            const tab = tabs.find(t => t.relPath === ctxMenu.relPath);
            if (tab?.content) {
              navigator.clipboard.writeText(tab.content);
            } else {
              fetchContent(ctxMenu.relPath).then(c => { if (c) navigator.clipboard.writeText(c); });
            }
            setCtxMenu(null);
          }}
        />
      )}
    </div>
  );
}
