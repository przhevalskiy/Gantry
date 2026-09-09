import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, FolderTree, RefreshCw, Save, X } from 'lucide-react';
import type { Project } from '@/shared/types';
import { gantryClient } from '@/shared/services/gantry/client';
import type { AgentFileEntry } from './swarmUtils';
import { buildFileTree, type TreeNode } from './fileTree';
import { CodeEditor } from './CodeEditor';
import { CodeViewer } from './CodeViewer';
import './IdeFileExplorer.css';

type Tab = { relPath: string; content: string; dirty?: boolean };

const MAX_TABS = 6;
const BUILDER_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7'];

function TreeRow({
  node,
  depth,
  activePath,
  agentOnFile,
  recentPaths,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  agentOnFile: Map<string, AgentFileEntry>;
  recentPaths: Set<string>;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const agent = agentOnFile.get(node.path);
  const isRecent = recentPaths.has(node.path);
  const active = activePath === node.path;

  if (node.isFile) {
    return (
      <button
        type="button"
        className={`ide-tree-row file ${active ? 'active' : ''} ${isRecent ? 'recent' : ''}`}
        style={{ paddingLeft: `${10 + depth * 12}px` }}
        onClick={() => onSelect(node.path)}
      >
        <FileText size={12} />
        <span>{node.name}</span>
        {agent?.role === 'builder' && (
          <span
            className="ide-agent-dot"
            style={{ background: BUILDER_COLORS[agent.builderIdx % BUILDER_COLORS.length] }}
            title="Builder active"
          />
        )}
      </button>
    );
  }

  return (
    <div className="ide-tree-dir">
      <button
        type="button"
        className="ide-tree-row dir"
        style={{ paddingLeft: `${10 + depth * 12}px` }}
        onClick={() => setOpen(v => !v)}
      >
        <FolderTree size={12} />
        <span>{node.name}</span>
        <span className="ide-tree-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && node.children.map(child => (
        <TreeRow
          key={child.path}
          node={child}
          depth={depth + 1}
          activePath={activePath}
          agentOnFile={agentOnFile}
          recentPaths={recentPaths}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export type IdeFileExplorerProps = {
  project: Project;
  isRunning?: boolean;
  taskStatus?: string;
  buildBranch?: string | null;
  writtenPaths?: string[];
  agentOnFile?: Map<string, AgentFileEntry>;
  editable?: boolean;
  layout?: 'split' | 'stack';
};

export function IdeFileExplorer({
  project,
  isRunning = false,
  taskStatus = 'running',
  buildBranch = null,
  writtenPaths = [],
  agentOnFile = new Map(),
  editable = true,
  layout = 'split',
}: IdeFileExplorerProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [source, setSource] = useState<'workspace' | 'github'>('workspace');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const userSelectedAt = useRef(0);

  const useGithub = !isRunning && Boolean(buildBranch && project.github_owner && project.github_repo);
  const canEdit = editable && source === 'workspace' && !useGithub;

  const recentPaths = useMemo(() => new Set(writtenPaths.slice(-8)), [writtenPaths]);

  const refreshTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (useGithub) {
        const data = await gantryClient.projectGithubTree(project.id, buildBranch ?? 'main');
        setFiles(data.files);
        setSource('github');
      } else {
        const data = await gantryClient.projectWorkspaceTree(project.id);
        setFiles(data.files);
        setSource('workspace');
      }
    } catch (err) {
      setFiles([]);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [project.id, useGithub, buildBranch]);

  useEffect(() => {
    void refreshTree();
    const ms = isRunning ? 2500 : 8000;
    const id = setInterval(() => { void refreshTree(); }, ms);
    return () => clearInterval(id);
  }, [refreshTree, isRunning]);

  const fetchContent = useCallback(async (rel: string): Promise<string> => {
    if (useGithub) {
      const data = await gantryClient.projectGithubFile(project.id, rel, buildBranch ?? 'main');
      return data.content;
    }
    const data = await gantryClient.projectWorkspaceFile(project.id, rel);
    return data.content;
  }, [project.id, useGithub, buildBranch]);

  const openFile = useCallback(async (rel: string, userGesture = true) => {
    if (userGesture) userSelectedAt.current = Date.now();
    setActiveTab(rel);
    setTabs(prev => {
      if (prev.some(t => t.relPath === rel)) return prev;
      let next = [...prev, { relPath: rel, content: '' }];
      if (next.length > MAX_TABS) next = next.slice(-MAX_TABS);
      return next;
    });
    try {
      const content = await fetchContent(rel);
      setTabs(prev => prev.map(t => (t.relPath === rel ? { ...t, content, dirty: false } : t)));
    } catch (err) {
      setTabs(prev => prev.map(t => (t.relPath === rel ? { ...t, content: `// ${(err as Error).message}` } : t)));
    }
  }, [fetchContent]);

  useEffect(() => {
    if (agentOnFile.size === 0 || Date.now() - userSelectedAt.current < 5000) return;
    const builder = Array.from(agentOnFile.entries()).find(([, e]) => e.role === 'builder');
    const target = builder ?? Array.from(agentOnFile.entries())[0];
    if (target) void openFile(target[0], false);
  }, [agentOnFile, openFile]);

  useEffect(() => {
    if (writtenPaths.length === 0 || agentOnFile.size > 0) return;
    if (Date.now() - userSelectedAt.current < 5000) return;
    const last = writtenPaths[writtenPaths.length - 1];
    const rel = files.includes(last) ? last : files.find(f => f.endsWith(last)) ?? last;
    void openFile(rel, false);
  }, [writtenPaths, files, agentOnFile.size, openFile]);

  useEffect(() => {
    if (!activeTab || !isRunning) return;
    const hot = agentOnFile.has(activeTab);
    const id = setInterval(async () => {
      try {
        const content = await fetchContent(activeTab);
        setTabs(prev => prev.map(t =>
          t.relPath === activeTab && !t.dirty ? { ...t, content } : t,
        ));
      } catch { /* ignore */ }
    }, hot ? 800 : 2000);
    return () => clearInterval(id);
  }, [activeTab, isRunning, fetchContent, agentOnFile]);

  const activeData = tabs.find(t => t.relPath === activeTab) ?? null;
  const tree = useMemo(() => buildFileTree(files), [files]);

  const closeTab = (rel: string) => {
    setTabs(prev => prev.filter(t => t.relPath !== rel));
    if (activeTab === rel) {
      const remaining = tabs.filter(t => t.relPath !== rel);
      setActiveTab(remaining.at(-1)?.relPath ?? null);
    }
  };

  const saveActive = async () => {
    if (!activeTab || !activeData || !canEdit) return;
    setSaving(true);
    try {
      await gantryClient.saveProjectWorkspaceFile(project.id, activeTab, activeData.content);
      setTabs(prev => prev.map(t => (t.relPath === activeTab ? { ...t, dirty: false } : t)));
      await refreshTree();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const frozen = ['terminated', 'failed', 'canceled', 'cancelled', 'timeout'].includes(
    taskStatus.toLowerCase(),
  );

  return (
    <div className={`ide-explorer layout-${layout}`}>
      <div className="ide-explorer-toolbar">
        <div>
          <strong>Explorer</strong>
          <span className="ide-explorer-source">
            {source === 'github' ? `GitHub · ${buildBranch}` : 'Workspace'}
            {isRunning && !frozen && ' · live'}
          </span>
        </div>
        <button type="button" className="ide-icon-btn" onClick={() => void refreshTree()} title="Refresh">
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {frozen && (
        <div className="ide-frozen-banner">Run {taskStatus.toLowerCase()} — files preserved</div>
      )}
      {error && <p className="ide-error">{error}</p>}

      <div className="ide-explorer-body">
        <div className="ide-tree-pane">
          {loading && files.length === 0 && <p className="ide-empty">Loading…</p>}
          {!loading && files.length === 0 && !error && (
            <p className="ide-empty">
              {isRunning
                ? 'Waiting for builders to write files…'
                : 'Empty — start a run or add files.'}
            </p>
          )}
          {tree.map(node => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              activePath={activeTab}
              agentOnFile={agentOnFile}
              recentPaths={recentPaths}
              onSelect={path => { void openFile(path); }}
            />
          ))}
        </div>

        <div className="ide-editor-pane">
          {tabs.length > 0 && (
            <div className="ide-tab-bar">
              {tabs.map(tab => (
                <button
                  key={tab.relPath}
                  type="button"
                  className={`ide-tab ${activeTab === tab.relPath ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.relPath)}
                >
                  {tab.relPath.split('/').pop()}
                  {tab.dirty ? ' •' : ''}
                  <span
                    className="ide-tab-close"
                    onClick={e => { e.stopPropagation(); closeTab(tab.relPath); }}
                  >
                    <X size={10} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {activeData ? (
            <>
              {canEdit ? (
                <>
                  <CodeEditor
                    relPath={activeData.relPath}
                    content={activeData.content}
                    onChange={value => {
                      setTabs(prev => prev.map(t =>
                        t.relPath === activeTab ? { ...t, content: value, dirty: true } : t,
                      ));
                    }}
                  />
                  <div className="ide-editor-actions">
                    <button
                      type="button"
                      className="ide-save-btn"
                      disabled={!activeData.dirty || saving}
                      onClick={() => void saveActive()}
                    >
                      <Save size={14} />
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </>
              ) : (
                <CodeViewer
                  relPath={activeData.relPath}
                  content={activeData.content}
                  isActive={isRunning && agentOnFile.has(activeData.relPath)}
                />
              )}
            </>
          ) : (
            <p className="ide-empty editor-empty">Select a file from the tree</p>
          )}
        </div>
      </div>
    </div>
  );
}
