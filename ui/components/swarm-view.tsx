'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useTask, useOptimisticTerminate } from '@/hooks/use-task';
import { saveReport } from '@/lib/report-store';
import { useTaskMessages } from '@/hooks/use-task-messages';
import { useSendFollowUp } from '@/hooks/use-send-followup';
import { MessageFeed } from '@/components/message-feed';
import { FileExplorer } from '@/components/file-explorer';
import { useFileAttachments, buildAttachmentBlock } from '@/hooks/use-file-attachments';
import type { Task } from 'agentex/resources';

import {
  getTaskGoal, getRepoPath, getTextContent,
  extractWrittenPaths, extractAgentOnFiles,
  parsePipeline,
} from './swarm/utils';
import { PipelineTracker } from './swarm/pipeline-tracker';
import { TracesPanel } from './swarm/traces-panel';
import { ContextUsageIndicator } from './swarm/context-usage';
import { PreviewPane } from './swarm/preview-pane';
import { ReportCard, StatusBadge } from './swarm/report-card';

export type { AgentFileEntry } from './swarm/utils';

function Spinner() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth={2} strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export function SwarmView({ taskId }: { taskId: string }) {
  const { data: task, isLoading: taskLoading } = useTask(taskId);
  const optimisticTerminate = useOptimisticTerminate(taskId);
  const { data: messages, isLoading: msgsLoading } = useTaskMessages(taskId);
  const [followUp, setFollowUp] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [leftTab, setLeftTab] = useState<'explorer' | 'preview'>(() => {
    if (typeof window === 'undefined') return 'explorer';
    return (localStorage.getItem('ks_left_tab') as 'explorer' | 'preview') ?? 'explorer';
  });
  const [rightTab, setRightTab] = useState<'activity' | 'crew' | 'traces'>(() => {
    if (typeof window === 'undefined') return 'activity';
    return (localStorage.getItem('ks_right_tab') as 'activity' | 'crew' | 'traces') ?? 'activity';
  });
  const [manualUrl, setManualUrl] = useState('');
  const [stopping, setStopping] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const followUpFileInputRef = useRef<HTMLInputElement>(null);
  const sendFollowUp = useSendFollowUp(taskId);
  const { files: followUpFiles, error: followUpFileError, addFiles: addFollowUpFiles, removeFile: removeFollowUpFile, clearAll: clearFollowUpFiles } = useFileAttachments();

  const status = task?.status ?? 'RUNNING';
  const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'TERMINATED', 'CANCELED', 'TIMED_OUT', 'DELETED']);
  const isDone = TERMINAL_STATUSES.has(status);
  const isFailed = status === 'FAILED' || status === 'TERMINATED' || status === 'TIMED_OUT';
  const goal = getTaskGoal(task as Task | undefined);
  const repoPath = getRepoPath(task as Task | undefined) || '';
  const writtenPaths = extractWrittenPaths(messages ?? []);
  const agentOnFile = extractAgentOnFiles(messages ?? [], repoPath);
  const { stages, finalReport, prUrl, tierMeta, isReplanning, coveragePct } = parsePipeline(messages, isDone, isFailed);
  const effectivelyDone = isDone || !!finalReport;

  useEffect(() => {
    if (isDone && stopping) setStopping(false);
  }, [isDone, stopping]);

  const detectedUrl = (() => {
    const DEV_URL_RE = /https?:\/\/localhost:\d+/;
    for (let i = (messages ?? []).length - 1; i >= 0; i--) {
      const text = getTextContent((messages ?? [])[i]);
      const m = text?.match(DEV_URL_RE);
      if (m) return m[0];
    }
    return null;
  })();

  const activePreviewUrl = manualUrl.trim() || detectedUrl || '';

  useEffect(() => {
    if (!finalReport) return;
    saveReport({ taskId, query: goal, answer: finalReport, createdAt: new Date().toISOString(), summary: finalReport.slice(0, 400) });
  }, [finalReport, taskId, goal]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const HITL_SIGNALS = [
      '__clarification_request__',
      '__approval_request__',
      'Waiting for follow-up instructions',
    ];
    for (let i = messages.length - 1; i >= 0; i--) {
      const text = getTextContent(messages[i]);
      if (!text) continue;
      if (HITL_SIGNALS.some(s => text.includes(s))) {
        saveReport({ taskId, query: goal, answer: '', createdAt: new Date().toISOString(), lastMessageContent: text });
        return;
      }
    }
    saveReport({ taskId, query: goal, answer: '', createdAt: new Date().toISOString(), lastMessageContent: '' });
  }, [messages, taskId, goal]);

  const submitFollowUp = () => {
    const text = followUp.trim();
    if (!text || sendFollowUp.isPending) return;
    const attachmentBlock = buildAttachmentBlock(followUpFiles);
    const fullText = text + attachmentBlock;
    sendFollowUp.mutate(fullText, { onSuccess: () => { setFollowUp(''); clearFollowUpFiles(); } });
  };

  if (taskLoading && !task) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header bar */}
      <div style={{
        height: 44, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        background: 'var(--background)',
        paddingLeft: '0.75rem', paddingRight: '0.875rem',
        gap: '0.5rem',
      }}>
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          textDecoration: 'none', color: 'var(--text-secondary)',
          fontSize: '0.82rem', fontWeight: 600, letterSpacing: '-0.01em',
          opacity: 0.7, flexShrink: 0,
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Gantry
        </Link>

        <span style={{ color: 'var(--border)', fontSize: '1rem', opacity: 0.6, flexShrink: 0 }}>/</span>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '0.2rem 0.625rem',
            maxWidth: '520px', minWidth: 0,
          }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
            </svg>
            <span style={{
              fontSize: '0.78rem', color: 'var(--text-secondary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {goal || taskId}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{
            fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'monospace',
            opacity: 0.35,
          }}>
            {taskId.slice(0, 8)}
          </span>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Main content (70/30 split) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* Left 70%: Explorer / Preview */}
      <div style={{ flex: '0 0 70%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', alignItems: 'stretch', flexShrink: 0,
          borderBottom: '1px solid var(--border)', background: 'var(--background)',
        }}>
          {(['explorer', 'preview'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setLeftTab(tab); localStorage.setItem('ks_left_tab', tab); }}
              style={{
                padding: '0 1.125rem', height: '36px', border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'inherit',
                fontSize: '0.75rem', fontWeight: leftTab === tab ? 600 : 400,
                color: leftTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: leftTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 0.1s',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'preview' && activePreviewUrl && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
              )}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {leftTab === 'explorer' ? (
            <FileExplorer repoRoot={repoPath} writtenPaths={writtenPaths} agentOnFile={agentOnFile} isRunning={!effectivelyDone} taskStatus={status} />
          ) : (
            <PreviewPane url={activePreviewUrl} onUrlChange={setManualUrl} manualUrl={manualUrl} />
          )}
        </div>
      </div>

      {/* Right 30%: Activity / Crew / Traces */}
      <div style={{ flex: '0 0 30%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'stretch', flexShrink: 0,
          borderBottom: '1px solid var(--border)', background: 'var(--background)',
        }}>
          {(['activity', 'crew', 'traces'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setRightTab(tab); localStorage.setItem('ks_right_tab', tab); }}
              style={{
                padding: '0 1.125rem', height: '36px', border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'inherit',
                fontSize: '0.75rem', fontWeight: rightTab === tab ? 600 : 400,
                color: rightTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: rightTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 0.1s',
              }}
            >
              {tab === 'activity' ? 'Activity' : tab === 'crew' ? 'Crew' : 'Traces'}
            </button>
          ))}
          <div style={{ flex: 1 }} />
        </div>

        {/* Activity tab */}
        {rightTab === 'activity' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0.875rem', display: 'flex', flexDirection: 'column' }}>
              {msgsLoading && !messages ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
                  <Spinner />
                </div>
              ) : (
                <MessageFeed messages={messages ?? []} isRunning={!effectivelyDone} taskId={taskId} autoApprove={autoApprove} taskStatus={status} />
              )}
            </div>

            <div style={{ padding: '0.625rem 0.75rem', flexShrink: 0, background: 'var(--background)' }}>
              <input
                ref={followUpFileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files) { addFollowUpFiles(e.target.files); e.target.value = ''; } }}
              />

              <div style={{
                border: `1.5px solid ${followUp.trim() ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '16px',
                background: 'var(--surface)',
                transition: 'border-color 0.15s',
              }}>
                {followUpFiles.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', padding: '0.5rem 0.75rem 0' }}>
                    {followUpFiles.map((f, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        background: 'var(--surface-raised)', border: '1px solid var(--border)',
                        borderRadius: '5px', padding: '0.15rem 0.4rem',
                        fontSize: '0.68rem', color: 'var(--text-secondary)', maxWidth: '160px',
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        <button type="button" onClick={() => removeFollowUpFile(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', lineHeight: 1, fontSize: '0.7rem' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {(sendFollowUp.isError || followUpFileError) && (
                  <p style={{ fontSize: '0.68rem', color: 'var(--error)', padding: '0.25rem 0.75rem 0', margin: 0 }}>{followUpFileError || 'Failed to send'}</p>
                )}
                {sendFollowUp.isSuccess && (
                  <p style={{ fontSize: '0.68rem', color: 'var(--success)', padding: '0.25rem 0.75rem 0', margin: 0 }}>Sent ✓</p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.625rem 0.75rem 0.5rem' }}>
                  <textarea
                    ref={inputRef}
                    value={followUp}
                    onChange={e => setFollowUp(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitFollowUp(); } }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) addFollowUpFiles(e.dataTransfer.files); }}
                    placeholder={effectivelyDone ? 'Send a follow-up to the foreman…' : 'Foreman is building — queue a follow-up…'}
                    rows={1}
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      resize: 'none', fontFamily: 'inherit', fontSize: '0.82rem',
                      color: 'var(--text-primary)', lineHeight: '1.5',
                      padding: 0,
                      maxHeight: '120px', overflowY: 'auto',
                    }}
                  />

                  {status === 'RUNNING' && !isDone && !followUp.trim() ? (
                    <button
                      type="button"
                      title="Stop task"
                      disabled={stopping}
                      onClick={async () => {
                        setStopping(true);
                        const res = await fetch(`/api/tasks/${taskId}/terminate`, { method: 'POST' });
                        if (res.ok) {
                          optimisticTerminate();
                        } else {
                          const body = await res.json().catch(() => ({}));
                          const errMsg: string = body.error ?? res.statusText ?? '';
                          if (errMsg.toLowerCase().includes('already completed') || errMsg.toLowerCase().includes('already finished')) {
                            optimisticTerminate();
                          } else {
                            alert(`Stop failed: ${errMsg}`);
                            setStopping(false);
                          }
                        }
                      }}
                      style={{
                        flexShrink: 0, width: 30, height: 30, borderRadius: '50%', border: 'none',
                        background: stopping ? 'var(--surface-raised)' : 'var(--error)',
                        color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: stopping ? 'default' : 'pointer',
                        opacity: stopping ? 0.5 : 1,
                        transition: 'background 0.15s, opacity 0.15s',
                      }}
                    >
                      {stopping ? (
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite' }}>
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                      ) : (
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor">
                          <rect x="4" y="4" width="16" height="16" rx="2"/>
                        </svg>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={submitFollowUp}
                      disabled={!followUp.trim() || sendFollowUp.isPending}
                      title="Send (Enter)"
                      style={{
                        flexShrink: 0, width: 30, height: 30, borderRadius: '50%', border: 'none',
                        background: followUp.trim() ? 'var(--accent)' : 'var(--surface-raised)',
                        color: followUp.trim() ? 'white' : 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: followUp.trim() ? 'pointer' : 'default',
                        opacity: sendFollowUp.isPending ? 0.5 : 1,
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >
                      {sendFollowUp.isPending ? (
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite' }}>
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                      ) : (
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 19V5M5 12l7-7 7 7" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '0.3rem 0.625rem 0.5rem',
                  borderTop: '1px solid var(--border)',
                  gap: '0.25rem',
                  borderRadius: '0 0 14px 14px',
                }}>
                  <button
                    type="button"
                    onClick={() => followUpFileInputRef.current?.click()}
                    title="Attach files"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '0.25rem', display: 'flex', alignItems: 'center',
                      color: followUpFiles.length ? 'var(--accent)' : 'var(--text-secondary)',
                      opacity: 0.55, borderRadius: '5px',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.55'; }}
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                  </button>

                  <ContextUsageIndicator messages={messages ?? []} taskId={taskId} repoPath={repoPath} />

                  <div style={{ flex: 1 }} />

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.7, userSelect: 'none' }}>
                      Auto-approve
                    </span>
                    <div
                      onClick={() => setAutoApprove(p => !p)}
                      style={{
                        width: 30, height: 17, borderRadius: 999,
                        background: autoApprove ? 'var(--accent)' : 'var(--surface-raised)',
                        border: '1px solid var(--border)',
                        position: 'relative', cursor: 'pointer', transition: 'background 0.15s',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 2, width: 11, height: 11, borderRadius: '50%',
                        left: autoApprove ? 15 : 2,
                        background: autoApprove ? 'white' : 'var(--text-secondary)',
                        transition: 'left 0.15s',
                      }} />
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Crew tab */}
        {rightTab === 'crew' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {tierMeta && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.375rem',
                padding: '0.5rem 0.75rem',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '8px', fontSize: '0.72rem',
              }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  Tier {tierMeta.tier} · {tierMeta.label}
                </span>
                {tierMeta.estimatedFiles != null && (
                  <span style={{ color: 'var(--text-secondary)' }}>~{tierMeta.estimatedFiles} files</span>
                )}
                {tierMeta.estimatedMinutes != null && (
                  <span style={{ color: 'var(--text-secondary)' }}>~{tierMeta.estimatedMinutes} min</span>
                )}
                {tierMeta.riskFlags.length > 0 && (
                  <span style={{
                    color: '#f97316', background: '#f9731615',
                    border: '1px solid #f9731630', borderRadius: '4px',
                    padding: '0.05rem 0.35rem', fontWeight: 600,
                  }}>
                    ⚠ {tierMeta.riskFlags.slice(0, 3).join(', ')}
                  </span>
                )}
              </div>
            )}

            {isReplanning && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0.75rem',
                background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
                borderRadius: '8px', fontSize: '0.72rem', color: 'var(--warning)',
              }}>
                <span style={{ animation: 'pulseDot 1.2s ease-in-out infinite', display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 }} />
                Architect re-planning after build failure…
              </div>
            )}

            <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, marginBottom: '0.25rem' }}>
              {stages.filter(s => s.state !== 'pending').length} of {stages.length} agents deployed
            </p>
            <PipelineTracker stages={stages} messages={messages ?? []} />
            {prUrl && (
              <a href={prUrl} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.875rem', marginTop: '0.5rem',
                background: 'color-mix(in srgb, var(--success) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
                borderRadius: '8px', color: 'var(--success)',
                fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
              }}>
                🚀 Pull Request →
              </a>
            )}
            {finalReport && (
              <>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, marginTop: '0.5rem' }}>
                  Report
                </p>
                <ReportCard report={finalReport} coveragePct={coveragePct} />
              </>
            )}
          </div>
        )}

        {/* Traces tab */}
        {rightTab === 'traces' && (
          <TracesPanel taskId={taskId} repoPath={repoPath} />
        )}
      </div>

      </div>
    </div>
  );
}
