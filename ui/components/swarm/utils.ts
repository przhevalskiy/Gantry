'use client';

import type { Task, TaskMessage } from 'agentex/resources';

export const STATUS_LABEL: Record<string, string> = {
  RUNNING: 'Running',
  COMPLETED: 'Complete',
  FAILED: 'Failed',
  CANCELED: 'Canceled',
  TERMINATED: 'Terminated',
  TIMED_OUT: 'Timed out',
  DELETED: 'Deleted',
};

export const STATUS_COLOR: Record<string, string> = {
  RUNNING: 'var(--accent)',
  COMPLETED: 'var(--success)',
  FAILED: 'var(--error)',
  CANCELED: 'var(--text-secondary)',
  TERMINATED: 'var(--error)',
  TIMED_OUT: 'var(--warning)',
  DELETED: 'var(--text-secondary)',
};

export type StageState = 'pending' | 'active' | 'done' | 'failed';

export interface PipelineStage {
  key: string;
  label: string;
  state: StageState;
  subtracks?: string[];
}

export interface ParsedPipeline {
  stages: PipelineStage[];
  finalReport: string | null;
  prUrl: string | null;
  tierMeta: { label: string; tier: number; estimatedFiles?: number; estimatedMinutes?: number; riskFlags: string[] } | null;
  isReplanning: boolean;
  coveragePct: number | null;
}

export interface AgentFileEntry { role: string; builderIdx: number }

export function getTaskGoal(task: Task | undefined): string {
  if (!task) return '';
  const params = task.params as Record<string, unknown> | null | undefined;
  return (params?.prompt as string) ?? (params?.query as string) ?? '';
}

export function getRepoPath(task: Task | undefined): string {
  const params = task?.params as Record<string, unknown> | null | undefined;
  return (params?.repo_path as string) ?? '';
}

export function getTextContent(msg: { content: unknown }): string | null {
  const c = msg.content as { type?: string; content?: unknown } | null | undefined;
  if (!c) return null;
  if ((c.type === 'text' || !c.type) && typeof c.content === 'string') return c.content;
  return null;
}

const AGENT_FILE_RE = /^\[(PM|Foreman|Architect|Builder|Inspector|Security|DevOps)(?:\s+(\d+)|\s+\(([^)]+)\))?\] (?:write_file|patch_file|read_file):\s*(.+?)\s*$/i;

export function extractWrittenPaths(messages: TaskMessage[]): string[] {
  const paths: string[] = [];
  for (const msg of messages ?? []) {
    const c = msg.content as { type?: string; content?: unknown } | null | undefined;
    const text = (c?.type === 'text' || !c?.type) && typeof c?.content === 'string' ? c.content : '';
    const m = text.match(AGENT_FILE_RE);
    if (m && m[4]) paths.push(m[4].trim());
  }
  return paths;
}

const _builderSlots = new Map<string, number>();

export function extractAgentOnFiles(messages: TaskMessage[], repoRoot: string): Map<string, AgentFileEntry> {
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

const STAGE_SIGNALS: { stage: string; pattern: RegExp }[] = [
  { stage: 'pm',        pattern: /\[Foreman\] Dispatching PM/ },
  { stage: 'architect', pattern: /\[Foreman\] Dispatching Architect/ },
  { stage: 'builder',   pattern: /\[Foreman\] (?:Dispatching Builder|Launching \d+ parallel builder)/ },
  { stage: 'inspector', pattern: /\[Foreman\] Dispatching Inspector/ },
  { stage: 'security',  pattern: /\[Foreman\] Dispatching Security/ },
  { stage: 'devops',    pattern: /\[Foreman\] Dispatching DevOps/ },
];

const PARALLEL_LAUNCH_RE = /\[Foreman\] Launching \d+ parallel builders[^:]*:\s*(.+)/;
const WAVE_LAUNCH_RE = /\[Foreman\] wave \d+\/\d+: launching \d+ builder[^—]*—\s*(.+)/i;
const REPLAN_RE = /\[Foreman\].*re-invoking Architect.*revise/i;
const TIER_ANNOUNCE_RE = /\[Foreman\] Complexity tier:\s*(\w+)\s*\(Tier (\d+)\)(?:\s*\(([^)]+)\))?/i;

export function parsePipeline(
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

    const pm = text.match(PARALLEL_LAUNCH_RE);
    if (pm) {
      parallelTracks = pm[1].split(/\s*\+\s*|\s*,\s*/).map(s => s.trim()).filter(Boolean);
    }
    const wm = text.match(WAVE_LAUNCH_RE);
    if (wm) {
      const waveTracks = wm[1].split(/\s*\+\s*|\s*,\s*/).map(s => s.trim()).filter(Boolean);
      for (const t of waveTracks) {
        if (!parallelTracks.includes(t)) parallelTracks.push(t);
      }
    }

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

    if (REPLAN_RE.test(text)) isReplanning = true;
    if (/\[Architect\] Revised plan/.test(text) || /\[Architect\] Plan ready/.test(text)) isReplanning = false;

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
