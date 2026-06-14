'use client';

import { useState, useRef, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateTask } from '@/hooks/use-create-task';
import { useAgentConfigStore } from '@/lib/agent-config-store';
import { saveReport } from '@/lib/report-store';
import { buildAttachmentBlock } from '@/hooks/use-file-attachments';
import { useActiveProject } from '@/lib/use-projects';
import { useContextBuilder, ContextBuilderButton, FileChips } from './context-builder';
import { AgentSelector, TIER_OPTIONS, type TierKey } from './agent-selector';
import { RecentTasks } from './recent-tasks';
import { SuggestionCategories } from './suggestion-categories';

const ACCENT = '#f97316';

function IconFolder({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function IconArrowUp() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  );
}

function SpinnerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite', flexShrink: 0 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function goalToProjectName(goal: string): string {
  const stopWords = new Set(['a', 'an', 'the', 'with', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'from', 'build', 'create', 'make', 'add', 'implement', 'write', 'develop', 'design', 'set', 'up']);
  const words = goal
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w))
    .slice(0, 3);
  return words.join('-') || 'project';
}

export function SearchHome() {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const [tierKey, setTierKey] = useState<TierKey>('auto');
  const [newProjectName, setNewProjectName] = useState('');
  const [newGithubUrl, setNewGithubUrl] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const { mutate: createTask, isPending } = useCreateTask();
  const swarmConfig = useAgentConfigStore(s => s.config);
  const { activeProject, projects, addProject, selectProject } = useActiveProject();

  const {
    attachedFiles,
    attachError,
    addFiles,
    removeFile,
    clearFiles,
    fileDragging,
    setFileDragging,
    fileDropdownOpen,
    setFileDropdownOpen,
    fileDropdownRef,
  } = useContextBuilder();

  // Project dropdown
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setError('');

    const attachmentBlock = buildAttachmentBlock(attachedFiles);
    const fullQuery = trimmed + attachmentBlock;
    const tierOption = TIER_OPTIONS.find(t => t.key === tierKey);
    const extraTier = tierOption?.value !== undefined ? { tier: tierOption.value } : {};

    let project = activeProject;
    if (!project) {
      try {
        const name = goalToProjectName(trimmed);
        project = await addProject(name);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create project.');
        return;
      }
    }

    createTask({
      query: fullQuery,
      extraParams: {
        repo_path: project.repo_path,
        project_id: project.id,
        branch_prefix: swarmConfig.swarmBranchPrefix || 'swarm',
        max_heal_cycles: swarmConfig.swarmMaxHealCycles,
        ...extraTier,
        ...(project.github_url ? { github_url: project.github_url } : {}),
        ...(swarmConfig.githubToken ? { github_token: swarmConfig.githubToken } : {}),
      },
    }, {
      onSuccess: (task) => {
        saveReport({ taskId: task.id, query: trimmed, answer: '', createdAt: new Date().toISOString(), projectId: project!.id });
        clearFiles();
        router.push(`/task/${task.id}`);
      },
      onError: (err) =>
        setError(err instanceof Error ? err.message : 'Failed to start. Is the agent running?'),
    });
  }

  function onFormSubmit(e: React.FormEvent) { e.preventDefault(); void handleSubmit(query); }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); void handleSubmit(query); }
  }

  const canSubmit = !isPending && !!query.trim();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 2rem',
      gap: '2.5rem',
      backgroundImage: 'radial-gradient(circle, #d8d8d8 1px, transparent 1px)',
      backgroundSize: '48px 48px',
    }}>
      <style>{`
        @keyframes chibi-wave {
          0%    { transform: translateY(0px) scale(1); }
          8%    { transform: translateY(-16px) scale(1.1); }
          16%   { transform: translateY(0px) scale(1); }
          100%  { transform: translateY(0px) scale(1); }
        }
        .chibi-avatar {
          animation: chibi-wave 9s ease-in-out infinite;
          will-change: transform;
        }
      `}</style>

      {/* Chibi crew row */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {[
            { n: 1,  label: 'Foreman',   color: '#f97316' },
            { n: 4,  label: 'PM',         color: '#8b5cf6' },
            { n: 7,  label: 'Architect',  color: '#3b82f6' },
            { n: 10, label: 'Builder',    color: '#10b981' },
            { n: 18, label: 'Inspector',  color: '#f59e0b' },
            { n: 19, label: 'Reviewer',   color: '#a855f7' },
            { n: 22, label: 'Security',   color: '#ef4444' },
            { n: 25, label: 'DevOps',     color: '#06b6d4' },
          ].map(({ n, label, color }, i) => (
            <div
              key={label}
              title={label}
              className="chibi-avatar"
              style={{
                width: '64px', height: '64px',
                borderRadius: '50%', padding: '3px',
                background: color,
                marginLeft: i === 0 ? '0' : '-18px',
                zIndex: i, position: 'relative',
                animationDelay: `${(i * 0.22).toFixed(2)}s`,
                flexShrink: 0, boxSizing: 'border-box',
                filter: 'drop-shadow(-3px 0 4px rgba(0,0,0,0.15))',
              }}
            >
              <img
                src={`/avatars/avatar-${String(n).padStart(2, '0')}.png`}
                alt={label}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block', background: 'var(--background)' }}
              />
            </div>
          ))}
        </div>
        <p style={{ fontSize: '1.33rem', fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>
          Your durable engineering crew
        </p>
      </div>

      {/* Input card */}
      <div style={{ width: '100%', maxWidth: '680px' }}>
        <form onSubmit={onFormSubmit}>
          <div
            style={{
              background: 'var(--surface)',
              border: `1px solid ${fileDragging ? ACCENT : focused ? ACCENT : error ? 'var(--error)' : 'var(--border)'}`,
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              transition: 'border-color 0.15s ease',
              outline: fileDragging ? `2px dashed ${ACCENT}` : 'none',
              outlineOffset: '2px',
            }}
            onDragOver={e => { e.preventDefault(); setFileDragging(true); }}
            onDragLeave={() => setFileDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setFileDragging(false);
              if (e.dataTransfer.files.length) { addFiles(e.dataTransfer.files); setFileDropdownOpen(true); }
            }}
          >
            {/* File chips */}
            <FileChips attachedFiles={attachedFiles} removeFile={removeFile} />

            {/* Main row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem' }}>
              {/* Left: wrench */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <ContextBuilderButton
                  attachedFiles={attachedFiles}
                  addFiles={addFiles}
                  removeFile={removeFile}
                  clearFiles={clearFiles}
                  isPending={isPending}
                  fileDropdownOpen={fileDropdownOpen}
                  setFileDropdownOpen={setFileDropdownOpen}
                  fileDropdownRef={fileDropdownRef}
                />
              </div>

              {/* Text input */}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={fileDragging ? 'Drop files here…' : 'Describe what to build, fix, or refactor...'}
                disabled={isPending}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '0.9375rem', color: 'var(--text-primary)',
                  fontFamily: 'inherit', minWidth: 0,
                }}
              />

              {/* Send */}
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  flexShrink: 0, width: 34, height: 34, borderRadius: '50%',
                  background: canSubmit ? ACCENT : 'var(--surface-raised)',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  transition: 'background 0.15s ease',
                  color: canSubmit ? 'white' : 'var(--text-secondary)',
                }}
              >
                {isPending ? <SpinnerIcon size={15} /> : <IconArrowUp />}
              </button>
            </div>

            {/* Bottom row: project pill left, crew right */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem 0.625rem' }}>
              {/* Project selector pill */}
              <div ref={projectDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    setShowNewProjectInput(false);
                    setProjectDropdownOpen(p => !p);
                  }}
                  disabled={isPending}
                  style={{
                    background: activeProject ? `${ACCENT}18` : 'transparent',
                    border: `1px solid ${activeProject ? ACCENT : 'var(--border)'}`,
                    borderRadius: '999px',
                    padding: '0.2rem 0.65rem',
                    color: activeProject ? ACCENT : 'var(--text-secondary)',
                    fontSize: '0.72rem',
                    fontWeight: activeProject ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    transition: 'all 0.12s ease',
                    maxWidth: '160px',
                  }}
                >
                  <IconFolder size={11} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeProject ? activeProject.name : 'New project'}
                  </span>
                  {activeProject?.github_url && (
                    <span title={activeProject.github_url} style={{ fontSize: '0.6rem', opacity: 0.7, flexShrink: 0 }}>⎇</span>
                  )}
                  <span style={{ opacity: 0.4, fontSize: '0.6rem', flexShrink: 0 }}>▾</span>
                </button>

                {projectDropdownOpen && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '10px', overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    zIndex: 200, minWidth: '220px',
                  }}>
                    {activeProject && (
                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          selectProject(null as unknown as string);
                          setProjectDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          width: '100%', padding: '0.625rem 0.875rem',
                          background: 'transparent', border: 'none',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                          color: 'var(--text-secondary)', fontSize: '0.8125rem',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                      >
                        <span style={{ opacity: 0.4, fontSize: '0.75rem' }}>✕</span>
                        <span>New project (auto)</span>
                      </button>
                    )}
                    {projects.length === 0 && !showNewProjectInput && !activeProject && (
                      <div style={{ padding: '0.625rem 0.875rem' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>No projects yet</span>
                      </div>
                    )}
                    {projects.map((p, idx) => {
                      const active = activeProject?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            selectProject(p.id);
                            setProjectDropdownOpen(false);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            width: '100%', padding: '0.625rem 0.875rem',
                            background: active ? `${ACCENT}12` : 'transparent',
                            border: 'none',
                            borderBottom: idx < projects.length - 1 || showNewProjectInput ? '1px solid var(--border)' : 'none',
                            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                          }}
                        >
                          <IconFolder size={12} />
                          <span style={{ fontSize: '0.8125rem', fontWeight: active ? 600 : 400, color: active ? ACCENT : 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </span>
                          {active && <span style={{ fontSize: '0.65rem', color: ACCENT }}>✓</span>}
                        </button>
                      );
                    })}

                    {showNewProjectInput ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', padding: '0.5rem 0.75rem', borderTop: projects.length > 0 ? '1px solid var(--border)' : 'none' }}>
                        <input
                          autoFocus
                          value={newProjectName}
                          onChange={e => setNewProjectName(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key !== 'Enter') return;
                            e.stopPropagation();
                            const name = newProjectName.trim();
                            if (!name || creatingProject) return;
                            setCreatingProject(true);
                            try {
                              await addProject(name, newGithubUrl.trim() || undefined);
                              setNewProjectName('');
                              setNewGithubUrl('');
                              setShowNewProjectInput(false);
                              setProjectDropdownOpen(false);
                            } catch { /* keep open */ } finally { setCreatingProject(false); }
                          }}
                          placeholder="Project name"
                          style={{
                            border: '1px solid var(--border)', borderRadius: '6px',
                            padding: '0.25rem 0.5rem', fontSize: '0.78rem',
                            background: 'var(--surface-raised)', color: 'var(--text-primary)',
                            fontFamily: 'inherit', outline: 'none',
                          }}
                        />
                        <input
                          value={newGithubUrl}
                          onChange={e => setNewGithubUrl(e.target.value)}
                          placeholder="GitHub URL (optional) — https://github.com/owner/repo"
                          style={{
                            border: '1px solid var(--border)', borderRadius: '6px',
                            padding: '0.25rem 0.5rem', fontSize: '0.72rem',
                            background: 'var(--surface-raised)', color: 'var(--text-secondary)',
                            fontFamily: 'monospace', outline: 'none',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button
                            type="button"
                            disabled={creatingProject || !newProjectName.trim()}
                            onClick={async () => {
                              const name = newProjectName.trim();
                              if (!name || creatingProject) return;
                              setCreatingProject(true);
                              try {
                                await addProject(name, newGithubUrl.trim() || undefined);
                                setNewProjectName('');
                                setNewGithubUrl('');
                                setShowNewProjectInput(false);
                                setProjectDropdownOpen(false);
                              } catch { /* keep open */ } finally { setCreatingProject(false); }
                            }}
                            style={{
                              flex: 1, background: ACCENT, border: 'none', borderRadius: '6px',
                              padding: '0.25rem 0.5rem', color: 'white',
                              fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                              fontFamily: 'inherit', opacity: creatingProject ? 0.6 : 1,
                            }}
                          >
                            {creatingProject ? '…' : 'Create'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowNewProjectInput(false); setNewProjectName(''); setNewGithubUrl(''); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0 0.25rem' }}
                          >✕</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowNewProjectInput(true)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          width: '100%', padding: '0.625rem 0.875rem',
                          background: 'transparent', border: 'none',
                          borderTop: projects.length > 0 ? '1px solid var(--border)' : 'none',
                          cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: '0.8125rem', color: ACCENT,
                        }}
                      >
                        <span style={{ fontSize: '1rem', lineHeight: 1 }}>＋</span> New project
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Agent/crew selector */}
              <AgentSelector tierKey={tierKey} setTierKey={setTierKey} isPending={isPending} />
            </div>
          </div>

          {(error || attachError) && (
            <p style={{ color: 'var(--error)', fontSize: '0.8125rem', marginTop: '0.375rem', paddingLeft: '1.25rem' }}>
              {error || attachError}
            </p>
          )}
        </form>

        {/* Active task chips */}
        <RecentTasks />

        {/* Category suggestions */}
        <SuggestionCategories
          isPending={isPending}
          onSelect={item => { setQuery(item); inputRef.current?.focus(); }}
        />
      </div>
    </div>
  );
}
