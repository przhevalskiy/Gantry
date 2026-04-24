'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTask, useOptimisticTerminate } from '@/hooks/use-task';
import { saveReport } from '@/lib/report-store';
import { useTaskMessages } from '@/hooks/use-task-messages';
import { useSendFollowUp } from '@/hooks/use-send-followup';
import { MessageFeed } from '@/components/message-feed';
import { ChibiAvatar, BUILDER_RING_COLORS, type SwarmRole } from '@/components/chibi-avatar';
import { FileExplorer } from '@/components/file-explorer';
import { useFileAttachments, buildAttachmentBlock } from '@/hooks/use-file-attachments';
import type { Task } from 'agentex/resources';
import type { TaskMessage } from 'agentex/resources';

const STATUS_LABEL: Record<string, string> = {
  RUNNING: 'Running',
  COMPLETED: 'Complete',
  FAILED: 'Failed',
  CANCELED: 'Canceled',
  TERMINATED: 'Terminated',
  TIMED_OUT: 'Timed out',
  DELETED: 'Deleted',
};

const STATUS_COLOR: Record<string, string> = {
  RUNNING: 'var(--accent)',
  COMPLETED: 'var(--success)',
  FAILED: 'var(--error)',
  CANCELED: 'var(--text-secondary)',
  TERMINATED: 'var(--error)',
  TIMED_OUT: 'var(--warning)',
  DELETED: 'var(--text-secondary)',
};

type StageState = 'pending' | 'active' | 'done' | 'failed';

interface PipelineStage {
  key: string;
  label: string;
  state: StageState;
  subtracks?: string[]; // parallel builder tracks
}

function getTaskGoal(task: Task | undefined): string {
  if (!task) return '';
  const params = task.params as Record<string, unknown> | null | undefined;
  return (params?.prompt as string) ?? (params?.query as string) ?? '';
}

function getRepoPath(task: Task | undefined): string {
  const params = task?.params as Record<string, unknown> | null | undefined;
  return (params?.repo_path as string) ?? '';
}

// Captures role + optional index/track suffix: [Builder 1], [Builder (frontend)], etc.
const AGENT_FILE_RE = /^\[(PM|Foreman|Architect|Builder|Inspector|Security|DevOps)(?:\s+(\d+)|\s+\(([^)]+)\))?\] (?:write_file|patch_file|read_file):\s*(.+?)\s*$/i;

export interface AgentFileEntry { role: string; builderIdx: number }

function extractWrittenPaths(messages: TaskMessage[]): string[] {
  const paths: string[] = [];
  for (const msg of messages ?? []) {
    const c = msg.content as { type?: string; content?: unknown } | null | undefined;
    const text = (c?.type === 'text' || !c?.type) && typeof c?.content === 'string' ? c.content : '';
    const m = text.match(AGENT_FILE_RE);
    if (m && m[4]) paths.push(m[4].trim());
  }
  return paths;
}

// Track which builder index maps to which sequential slot so colors stay stable
const _builderSlots = new Map<string, number>();

// Returns map of relPath → { role, builderIdx } for the most recent agent on each file
function extractAgentOnFiles(messages: TaskMessage[], repoRoot: string): Map<string, AgentFileEntry> {
  const map = new Map<string, AgentFileEntry>();
  for (const msg of messages ?? []) {
    const c = msg.content as { type?: string; content?: unknown } | null | undefined;
    const text = (c?.type === 'text' || !c?.type) && typeof c?.content === 'string' ? c.content : '';
    const m = text.match(AGENT_FILE_RE);
    if (!m) continue;
    const role = m[1].toLowerCase();
    const rawPath = (m[4] ?? '').trim();
    if (!rawPath) continue;
    const rel = rawPath.startsWith(repoRoot)
      ? rawPath.slice(repoRoot.length).replace(/^\//, '')
      : rawPath;

    // Assign a stable color slot per builder tag (e.g. "Builder 1", "Builder (frontend)")
    let builderIdx = 0;
    if (role === 'builder') {
      const tag = m[2] ?? m[3] ?? '0';
      if (!_builderSlots.has(tag)) _builderSlots.set(tag, _builderSlots.size);
      builderIdx = _builderSlots.get(tag)!;
    }

    map.set(rel, { role, builderIdx });
  }
  return map;
}

function getTextContent(msg: { content: unknown }): string | null {
  const c = msg.content as { type?: string; content?: unknown } | null | undefined;
  if (!c) return null;
  if ((c.type === 'text' || !c.type) && typeof c.content === 'string') return c.content;
  return null;
}

// Foreman dispatch tags that mark stage transitions
const STAGE_SIGNALS: { stage: string; pattern: RegExp }[] = [
  { stage: 'pm',         pattern: /\[Foreman\] Dispatching PM/ },
  { stage: 'architect',  pattern: /\[Foreman\] Dispatching Architect/ },
  { stage: 'builder',    pattern: /\[Foreman\] (?:Dispatching Builder|Launching \d+ parallel builder)/ },
  { stage: 'inspector',  pattern: /\[Foreman\] Dispatching Inspector/ },
  { stage: 'security',   pattern: /\[Foreman\] Dispatching Security/ },
  { stage: 'devops',     pattern: /\[Foreman\] Dispatching DevOps/ },
];

// Detect parallel track labels from "[Foreman] Launching N parallel builders (…): frontend + backend + tests"
const PARALLEL_LAUNCH_RE = /\[Foreman\] Launching \d+ parallel builders[^:]*:\s*(.+)/;
// Phase 4 wave launch: "[Foreman] wave 1/2: launching 2 builder(s) — backend + api"
const WAVE_LAUNCH_RE = /\[Foreman\] wave \d+\/\d+: launching \d+ builder[^—]*—\s*(.+)/i;
// Phase 2 re-plan trigger
const REPLAN_RE = /\[Foreman\].*re-invoking Architect.*revise/i;
// Phase 1 tier announcement with estimates
const TIER_ANNOUNCE_RE = /\[Foreman\] Complexity tier:\s*(\w+)\s*\(Tier (\d+)\)(?:\s*\(([^)]+)\))?/i;

interface ParsedPipeline {
  stages: PipelineStage[];
  finalReport: string | null;
  prUrl: string | null;
  tierMeta: { label: string; tier: number; estimatedFiles?: number; estimatedMinutes?: number; riskFlags: string[] } | null;
  isReplanning: boolean;
  coveragePct: number | null;
}

function parsePipeline(
  messages: { content: unknown }[] | undefined,
  isDone: boolean,
  isFailed: boolean,
): ParsedPipeline {
  const STAGE_KEYS = ['pm', 'architect', 'builder', 'inspector', 'security', 'devops'];

  let activeStage: string | null = null;
  let parallelTracks: string[] = [];
  let finalReport: string | null = null;
  const reachedStages = new Set<string>();
  let tierMeta: ParsedPipeline['tierMeta'] = null;
  let isReplanning = false;
  let coveragePct: number | null = null;

  for (const msg of messages ?? []) {
    const text = getTextContent(msg);
    if (!text) continue;

    for (const { stage, pattern } of STAGE_SIGNALS) {
      if (pattern.test(text)) {
        reachedStages.add(stage);
        activeStage = stage;
      }
    }

    // Parallel track labels from launch message
    const pm = text.match(PARALLEL_LAUNCH_RE);
    if (pm) {
      parallelTracks = pm[1].split(/\s*\+\s*|\s*,\s*/).map(s => s.trim()).filter(Boolean);
    }
    // Phase 4 wave launch — also captures track names
    const wm = text.match(WAVE_LAUNCH_RE);
    if (wm) {
      const waveTracks = wm[1].split(/\s*\+\s*|\s*,\s*/).map(s => s.trim()).filter(Boolean);
      // Merge wave tracks into parallelTracks (union, preserve order)
      for (const t of waveTracks) {
        if (!parallelTracks.includes(t)) parallelTracks.push(t);
      }
    }

    // Phase 1/3 tier announcement
    if (!tierMeta) {
      const tm = text.match(TIER_ANNOUNCE_RE);
      if (tm) {
        const details = tm[3] ?? '';
        const filesMatch = details.match(/~(\d+)\s*files?/i);
        const minsMatch = details.match(/~(\d+)\s*min/i);
        const risksMatch = details.match(/risks?:\s*([^)]+)/i);
        tierMeta = {
          label: tm[1],
          tier: parseInt(tm[2], 10),
          estimatedFiles: filesMatch ? parseInt(filesMatch[1], 10) : undefined,
          estimatedMinutes: minsMatch ? parseInt(minsMatch[1], 10) : undefined,
          riskFlags: risksMatch ? risksMatch[1].split(/,\s*/).map(s => s.trim()).filter(Boolean) : [],
        };
      }
    }

    // Phase 2 re-plan detection
    if (REPLAN_RE.test(text)) isReplanning = true;
    // Re-plan resolved when Architect emits its revised plan
    if (/\[Architect\] Revised plan/.test(text) || /\[Architect\] Plan ready/.test(text)) isReplanning = false;

    // Phase 4 coverage from final report
    if (text.includes('## Swarm Factory Report')) {
      finalReport = text;
      const covMatch = text.match(/Coverage:\s*([\d.]+)%/i);
      if (covMatch) coveragePct = parseFloat(covMatch[1]);
    }
  }

  const prUrl = finalReport ? (finalReport.match(/PR opened → (https?:\/\/\S+)/)?.[1] ?? null) : null;

  const activeIdx = activeStage ? STAGE_KEYS.indexOf(activeStage) : -1;

  const stages: PipelineStage[] = STAGE_KEYS.map((key, i) => {
    const isActive = key === activeStage && !isDone && !isFailed;
    const isPast = isDone
      ? reachedStages.has(key)
      : (activeIdx >= 0 && i < activeIdx);

    let state: StageState = 'pending';
    if (isActive) state = 'active';
    else if (isPast && !isFailed) state = 'done';
    else if (isFailed && key === activeStage) state = 'failed';

    // PM is optional — skip it visually if it was never reached
    if (key === 'pm' && !reachedStages.has('pm') && state === 'pending') {
      return null as unknown as PipelineStage;
    }

    const label = key === 'builder' && parallelTracks.length > 1
      ? `Builder ×${parallelTracks.length}`
      : key === 'pm' ? 'PM'
      : key.charAt(0).toUpperCase() + key.slice(1);

    return {
      key,
      label,
      state,
      subtracks: key === 'builder' && parallelTracks.length > 1 ? parallelTracks : undefined,
    };
  }).filter(Boolean) as PipelineStage[];

  return { stages, finalReport, prUrl, tierMeta, isReplanning, coveragePct };
}

// ── Preview pane ──────────────────────────────────────────────────────────────

function PreviewPane({
  url,
  manualUrl,
  onUrlChange,
}: {
  url: string;
  manualUrl: string;
  onUrlChange: (v: string) => void;
}) {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Address bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.375rem 0.625rem', borderBottom: '1px solid var(--border)',
        background: 'var(--background)', flexShrink: 0,
      }}>
        <input
          value={manualUrl}
          onChange={e => onUrlChange(e.target.value)}
          placeholder={url ? url : 'http://localhost:3000'}
          style={{
            flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '5px', padding: '0.25rem 0.5rem',
            fontSize: '0.75rem', color: 'var(--text-primary)', fontFamily: 'monospace',
            outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          onKeyDown={e => { if (e.key === 'Enter') setReloadKey(k => k + 1); }}
        />
        <button
          onClick={() => setReloadKey(k => k + 1)}
          title="Reload"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '0.2rem 0.3rem',
            borderRadius: '4px', lineHeight: 1,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          ↺
        </button>
      </div>

      {/* iframe or empty state */}
      {url ? (
        <iframe
          key={reloadKey}
          src={url}
          style={{ flex: 1, border: 'none', background: '#fff' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
          color: 'var(--text-secondary)',
        }}>
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.25} strokeLinecap="round" style={{ opacity: 0.25 }}>
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          <p style={{ fontSize: '0.8rem', opacity: 0.4 }}>No preview URL yet</p>
          <p style={{ fontSize: '0.72rem', opacity: 0.3 }}>
            Enter a URL above or wait for the builder to start a dev server
          </p>
        </div>
      )}
    </div>
  );
}

export function SwarmView({ taskId }: { taskId: string }) {
  const { data: task, isLoading: taskLoading, refetch: refetchTask } = useTask(taskId);
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
  const goal = getTaskGoal(task);
  const repoPath = getRepoPath(task) || '';
  const writtenPaths = extractWrittenPaths(messages ?? []);
  const agentOnFile = extractAgentOnFiles(messages ?? [], repoPath);
  const { stages, finalReport, prUrl, tierMeta, isReplanning, coveragePct } = parsePipeline(messages, isDone, isFailed);
  const effectivelyDone = isDone || !!finalReport;

  // Reset stopping spinner as soon as the task reaches any terminal state
  useEffect(() => {
    if (isDone && stopping) setStopping(false);
  }, [isDone, stopping]);

  // Auto-detect dev server URL from messages
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

  // Persist final summary to report-store when swarm completes
  useEffect(() => {
    if (!finalReport) return;
    saveReport({ taskId, query: goal, answer: finalReport, createdAt: new Date().toISOString(), summary: finalReport.slice(0, 400) });
  }, [finalReport, taskId, goal]);

  // Persist last significant message content so the projects page can show
  // accurate HITL status (plan review, clarification, follow-up wait, etc.)
  // without needing to fetch the full message stream.
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // Walk messages newest-first to find the last meaningful signal
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

    // No HITL signal — clear any stale one so status shows "building"
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

      {/* ── Header bar ────────────────────────────────────────────────── */}
      <div style={{
        height: 44, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        background: 'var(--background)',
        paddingLeft: '0.75rem', paddingRight: '0.875rem',
        gap: '0.5rem',
      }}>
        {/* Left: logo + back */}
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

        {/* Separator */}
        <span style={{ color: 'var(--border)', fontSize: '1rem', opacity: 0.6, flexShrink: 0 }}>/</span>

        {/* Center: goal breadcrumb */}
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

        {/* Right: status + task id */}
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

      {/* ── Main content (70/30 split) ────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* ── Left 70%: Explorer / Preview ─────────────────────────────── */}
      <div style={{ flex: '0 0 70%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
        {/* Tab bar */}
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

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {leftTab === 'explorer' ? (
            <FileExplorer repoRoot={repoPath} writtenPaths={writtenPaths} agentOnFile={agentOnFile} isRunning={!effectivelyDone} taskStatus={status} />
          ) : (
            <PreviewPane url={activePreviewUrl} onUrlChange={setManualUrl} manualUrl={manualUrl} />
          )}
        </div>
      </div>

      {/* ── Right 30%: Activity / Crew ────────────────────────────────── */}
      <div style={{ flex: '0 0 30%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Tab bar + status */}
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

            {/* Follow-up input — Kiro-style oval */}
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
                {/* File chips */}
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

                {/* Error / success feedback */}
                {(sendFollowUp.isError || followUpFileError) && (
                  <p style={{ fontSize: '0.68rem', color: 'var(--error)', padding: '0.25rem 0.75rem 0', margin: 0 }}>{followUpFileError || 'Failed to send'}</p>
                )}
                {sendFollowUp.isSuccess && (
                  <p style={{ fontSize: '0.68rem', color: 'var(--success)', padding: '0.25rem 0.75rem 0', margin: 0 }}>Sent ✓</p>
                )}

                {/* Textarea row */}
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

                  {/* Send / Stop button — top-right of oval */}
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

                {/* Bottom toolbar — attach + auto-approve */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '0.3rem 0.625rem 0.5rem',
                  borderTop: '1px solid var(--border)',
                  gap: '0.25rem',
                  borderRadius: '0 0 14px 14px',
                }}>
                  {/* Attach */}
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

                  {/* Context usage indicator */}
                  <ContextUsageIndicator messages={messages ?? []} />

                  {/* Spacer */}
                  <div style={{ flex: 1 }} />

                  {/* Auto-approve toggle */}
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

            {/* Tier meta banner — Phase 1/3 */}
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

            {/* Re-plan badge — Phase 2 */}
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

      </div>{/* end main content */}
    </div>
  );
}

function PipelineTracker({ stages, messages }: { stages: PipelineStage[]; messages: { content: unknown }[] }) {
  // Extract last action per track from messages for the parallel lane display
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

  // Track previous active stage to animate connector
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
              {/* Animated connector from previous stage */}
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

              {/* Main stage row */}
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

              {/* Parallel builder lanes — shown when builder has multiple tracks */}
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
                        {/* Track color dot */}
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: trackColor, flexShrink: 0,
                          animation: isActive && !trackDone ? 'pulseDot 1.2s ease-in-out infinite' : 'none',
                        }} />
                        {/* Track label */}
                        <span style={{
                          fontSize: '0.78rem', fontWeight: 600,
                          color: trackColor, fontFamily: 'monospace',
                          minWidth: 60,
                        }}>
                          {track}
                        </span>
                        {/* Last action */}
                        {lastAction && (
                          <span style={{
                            fontSize: '0.72rem', color: 'var(--text-secondary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            flex: 1,
                          }}>
                            {lastAction}
                          </span>
                        )}
                        {/* Status */}
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

              {/* Single-track builder subtrack (legacy) */}
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

function ReportCard({ report, coveragePct }: { report: string; coveragePct: number | null }) {
  const covColor = coveragePct == null ? 'var(--text-secondary)'
    : coveragePct >= 80 ? 'var(--success)'
    : coveragePct >= 60 ? 'var(--warning)'
    : 'var(--error)';

  return (
    <div style={{
      padding: '1.25rem',
      background: 'var(--surface-raised)',
      borderRadius: '12px',
      border: '1px solid var(--border)',
    }}>
      {coveragePct != null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: '0.875rem', padding: '0.4rem 0.625rem',
          background: `color-mix(in srgb, ${covColor} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${covColor} 30%, transparent)`,
          borderRadius: '6px',
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: covColor }}>
            📊 Test coverage: {coveragePct.toFixed(1)}%
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
            {coveragePct >= 80 ? '✓ Good' : coveragePct >= 60 ? '⚠ Acceptable' : '✗ Low — add more tests'}
          </span>
        </div>
      )}
      <pre style={{
        fontFamily: 'inherit',
        fontSize: '0.8125rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        margin: 0,
      }}>
        {report}
      </pre>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  const color = STATUS_COLOR[status] ?? 'var(--text-secondary)';
  const isRunning = status === 'RUNNING';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      padding: '0.25rem 0.75rem',
      borderRadius: '999px',
      background: `${color}22`,
      border: `1px solid ${color}44`,
      flexShrink: 0,
    }}>
      {isRunning && (
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color, display: 'inline-block',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      )}
      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{label}</span>
    </div>
  );
}

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

function Spinner() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth={2} strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ── Traces Panel — Phase 5 (#14) ──────────────────────────────────────────────

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

function TracesPanel({ taskId, repoPath }: { taskId: string; repoPath: string }) {
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
    // Poll every 5s while the task may still be running
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

  // Group by agent for summary stats
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

      {/* Summary bar */}
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

      {/* Trace rows */}
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
            {/* Header row */}
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
              {/* Agent badge */}
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.35rem',
                borderRadius: '4px', background: `${color}20`, color,
                flexShrink: 0, fontFamily: 'monospace',
              }}>
                {trace.agent.split(/[\s_]/)[0].toUpperCase()}
              </span>

              {/* Turn */}
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                t{trace.turn}
              </span>

              {/* Tool */}
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

              {/* Tokens */}
              {(trace.tokens?.input || trace.tokens?.output) ? (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {((trace.tokens.input + trace.tokens.output) / 1000).toFixed(1)}k
                </span>
              ) : null}

              {/* Time */}
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                {time}
              </span>

              {/* Chevron */}
              <svg
                width={12} height={12} viewBox="0 0 24 24" fill="none"
                stroke="var(--text-secondary)" strokeWidth={2.5} strokeLinecap="round"
                style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Expanded detail */}
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

// ── Context usage indicator ───────────────────────────────────────────────────
// Estimates token usage from the message stream and shows a hover popover.
// Token counts are approximated as chars/4 (standard heuristic).
// Per-agent breakdown is derived from [AgentName] prefixes in message text.

const CONTEXT_WINDOW = 200_000; // claude-sonnet-4 context window
const CHARS_PER_TOKEN = 4;

// Pricing per million tokens (USD) — Claude Sonnet 4 + Haiku 3.5
const PRICING: Record<string, { input: number; output: number; label: string }> = {
  sonnet: { input: 3.00,  output: 15.00, label: 'Sonnet' },
  haiku:  { input: 0.25,  output: 1.25,  label: 'Haiku'  },
  mistral:{ input: 2.00,  output: 6.00,  label: 'Mistral' },
};

// Hybrid routing: first 2 turns + last 2 turns per agent = Sonnet, rest = Haiku
// We estimate ~20 turns per builder agent, ~8 per architect/inspector
const AGENT_TURN_ESTIMATES: Record<string, number> = {
  builder:   20,
  architect: 8,
  inspector: 10,
  security:  8,
  devops:    6,
  pm:        6,
  foreman:   2,
};

// System prompt overhead per agent turn (tokens not visible in message stream)
// Includes: system prompt (~1.5k) + tool schemas (~1k) + context compression overhead
const SYSTEM_OVERHEAD_PER_TURN: Record<string, number> = {
  builder:   2500,  // large system prompt + all builder tools
  architect: 2000,  // system prompt + architect tools
  inspector: 2000,
  security:  1800,
  devops:    1800,
  pm:        1500,
  foreman:   500,
};

// Cost of one heal cycle: one builder pass (~20 turns) on Sonnet/Haiku hybrid
const HEAL_CYCLE_COST_USD = 0.38;

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

    // Add system prompt overhead: overhead_per_turn × estimated_turns
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

  // System prompt overhead cost (all Sonnet input — overhead is always input tokens)
  const overheadCost = (overheadTokens / 1_000_000) * PRICING.sonnet.input;

  // Heal cycle cost: each cycle = one builder pass per track
  const healCost = healCycles * builderCount * HEAL_CYCLE_COST_USD;

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

    // Extract agent name from [AgentName] prefix
    const m = text.match(/^\[([A-Za-z]+)/);
    const agent = m ? m[1].toLowerCase() : 'system';
    agentMap.set(agent, (agentMap.get(agent) ?? 0) + tokens);

    // Detect heal cycles from Foreman messages
    if (/heal cycle \d+/i.test(text) || /dispatching builder \(heal/i.test(text)) {
      const hm = text.match(/heal cycle (\d+)/i);
      if (hm) healCycles = Math.max(healCycles, parseInt(hm[1], 10));
      else healCycles = Math.max(healCycles, 1);
    }

    // Count distinct builder tracks
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

function ContextUsageIndicator({ messages, taskId, repoPath }: { messages: TaskMessage[]; taskId: string; repoPath: string }) {
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

  // Fetch real token counts from traces if available
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
  const barColor = pct >= 80 ? 'var(--error)' : pct >= 50 ? 'var(--warning)' : 'var(--success)';

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
      {/* Trigger button */}
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
        {/* Mini bar */}
        <div style={{
          width: 28, height: 4, borderRadius: 999,
          background: 'var(--surface-raised)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: barColor,
            borderRadius: 999,
            transition: 'width 0.3s',
          }} />
        </div>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {pct}%
        </span>
      </button>

      {/* Popover — fixed position so it escapes all stacking contexts */}
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
          {/* Header */}
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.125rem' }}>
              Context usage
            </p>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', margin: 0, opacity: 0.6 }}>
              ~{total.toLocaleString()} / {(CONTEXT_WINDOW / 1000).toFixed(0)}k tokens estimated
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div style={{
              height: 6, borderRadius: 999,
              background: 'var(--surface-raised)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: barColor, borderRadius: 999,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.68rem', color: barColor, fontWeight: 600 }}>{pct}% used</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.5 }}>
                ~{Math.round((CONTEXT_WINDOW - total) / 1000)}k remaining
              </span>
            </div>
          </div>

          {/* Per-agent breakdown */}
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

          {/* Cost estimate */}
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
              {/* Model split + overhead + heal cycles */}
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
              {/* Per-agent cost bars */}
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
