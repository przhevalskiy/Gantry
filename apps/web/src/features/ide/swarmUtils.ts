export type AgentFileEntry = { role: string; builderIdx: number };

export type TaskMessage = {
  content?: unknown;
};

const AGENT_FILE_RE =
  /^\[(PM|Foreman|Architect|Builder|Inspector|Security|DevOps)(?:\s+(\d+)|\s+\(([^)]+)\))?\] (?:write_file|patch_file|read_file):\s*(.+?)\s*$/i;

export function getTextContent(msg: TaskMessage): string | null {
  const c = msg.content as { type?: string; content?: unknown } | null | undefined;
  if (!c) return null;
  if ((c.type === 'text' || !c.type) && typeof c.content === 'string') return c.content;
  return null;
}

export function extractWrittenPaths(messages: TaskMessage[], repoRoot = ''): string[] {
  const paths: string[] = [];
  for (const msg of messages) {
    const text = getTextContent(msg) ?? '';
    const m = text.match(AGENT_FILE_RE);
    if (!m?.[4]) continue;
    let p = m[4].trim();
    if (repoRoot && p.startsWith(repoRoot)) {
      p = p.slice(repoRoot.length).replace(/^\//, '');
    }
    paths.push(p);
  }
  return paths;
}

const builderSlots = new Map<string, number>();

export function extractAgentOnFiles(
  messages: TaskMessage[],
  repoRoot: string,
): Map<string, AgentFileEntry> {
  const map = new Map<string, AgentFileEntry>();
  for (const msg of messages) {
    const text = getTextContent(msg) ?? '';
    const m = text.match(AGENT_FILE_RE);
    if (!m) continue;
    const role = m[1].toLowerCase();
    const rawPath = (m[4] ?? '').trim();
    if (!rawPath) continue;
    const rel = rawPath.startsWith(repoRoot)
      ? rawPath.slice(repoRoot.length).replace(/^\//, '')
      : rawPath.replace(/^\.\//, '');

    let builderIdx = 0;
    if (role === 'builder') {
      const tag = m[2] ?? m[3] ?? '0';
      if (!builderSlots.has(tag)) builderSlots.set(tag, builderSlots.size);
      builderIdx = builderSlots.get(tag)!;
    }
    map.set(rel, { role, builderIdx });
  }
  return map;
}

export type StageState = 'pending' | 'active' | 'done' | 'failed';

export type PipelineStage = {
  key: string;
  label: string;
  state: StageState;
};

const STAGE_SIGNALS: { stage: string; label: string; pattern: RegExp }[] = [
  { stage: 'pm', label: 'PM', pattern: /\[Foreman\] Dispatching PM/ },
  { stage: 'architect', label: 'Architect', pattern: /\[Foreman\] Dispatching Architect/ },
  { stage: 'builder', label: 'Builder', pattern: /\[Foreman\] (?:Dispatching Builder|Launching \d+ parallel builder)/ },
  { stage: 'inspector', label: 'Inspector', pattern: /\[Foreman\] Dispatching Inspector/ },
  { stage: 'reviewer', label: 'Reviewer', pattern: /\[Foreman\] Dispatching Reviewer/ },
  { stage: 'security', label: 'Security', pattern: /\[Foreman\] Dispatching Security/ },
  { stage: 'devops', label: 'DevOps', pattern: /\[Foreman\] Dispatching DevOps/ },
];

const STAGE_KEYS = STAGE_SIGNALS.map(s => s.stage);

export function parsePipelineStages(
  messages: TaskMessage[],
  status: string,
): PipelineStage[] {
  const terminal = new Set(['completed', 'failed', 'cancelled', 'terminated', 'timeout', 'canceled']);
  const isDone = terminal.has(status.toLowerCase());
  const isFailed = ['failed', 'terminated', 'timeout', 'canceled'].includes(status.toLowerCase());

  let activeStage: string | null = null;
  const reached = new Set<string>();

  for (const msg of messages) {
    const text = getTextContent(msg);
    if (!text) continue;
    for (const { stage, pattern } of STAGE_SIGNALS) {
      if (pattern.test(text)) {
        reached.add(stage);
        activeStage = stage;
      }
    }
  }

  const activeIdx = activeStage ? STAGE_KEYS.indexOf(activeStage) : -1;

  return STAGE_SIGNALS.map(({ stage, label }, i) => {
    if (stage === 'pm' && !reached.has('pm')) return null;
    const isActive = stage === activeStage && !isDone && !isFailed;
    const isPast = isDone ? reached.has(stage) : activeIdx >= 0 && i < activeIdx;
    let state: StageState = 'pending';
    if (isActive) state = 'active';
    else if (isPast && !isFailed) state = 'done';
    else if (isFailed && stage === activeStage) state = 'failed';
    return { key: stage, label, state };
  }).filter(Boolean) as PipelineStage[];
}

export function extractGoalFromMessages(messages: TaskMessage[]): string {
  for (const msg of messages) {
    const text = getTextContent(msg);
    if (text?.startsWith('Swarm Factory activated')) {
      const m = text.match(/Goal: (.+)/);
      if (m) return m[1].trim();
    }
  }
  return '';
}

export function extractDevUrl(messages: TaskMessage[]): string | null {
  const DEV_URL_RE = /https?:\/\/localhost:\d+/;
  for (let i = messages.length - 1; i >= 0; i--) {
    const text = getTextContent(messages[i]) ?? '';
    const match = text.match(DEV_URL_RE);
    if (match) return match[0];
  }
  return null;
}

export function extractPrUrl(messages: TaskMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const text = getTextContent(messages[i]) ?? '';
    const m = text.match(/PR (?:opened|ready) → (https?:\/\/\S+)|✓ PR ready: (https?:\/\/\S+)/i);
    if (m) return (m[1] ?? m[2]).replace(/[)\].,]+$/, '');
    if (text.includes('github.com') && text.includes('/pull/')) {
      const url = text.match(/https:\/\/github\.com\/\S+/);
      if (url) return url[0];
    }
  }
  return null;
}

export type HitlPrompt = {
  checkpoint: string;
  workflow_id: string;
  description?: string;
};

export function extractHitlFromMessages(messages: TaskMessage[]): HitlPrompt[] {
  const prompts: HitlPrompt[] = [];
  const resolved = new Set<string>();
  for (const msg of messages) {
    const text = getTextContent(msg) ?? '';
    if (text.startsWith('__approval_resolved__')) {
      try {
        const data = JSON.parse(text.replace('__approval_resolved__', ''));
        if (data.workflow_id) resolved.add(data.workflow_id);
      } catch { /* ignore */ }
    }
  }
  for (const msg of messages) {
    const text = getTextContent(msg) ?? '';
    if (!text.startsWith('__approval_request__')) continue;
    try {
      const data = JSON.parse(text.replace('__approval_request__', ''));
      if (data.workflow_id && !resolved.has(data.workflow_id)) {
        prompts.push({
          checkpoint: data.checkpoint ?? 'approval',
          workflow_id: data.workflow_id,
          description: data.action,
        });
      }
    } catch { /* ignore */ }
  }
  return prompts;
}

export type TierMeta = {
  label: string;
  tier: number;
  estimatedFiles?: number;
  estimatedMinutes?: number;
  riskFlags: string[];
};

export type PipelineMeta = {
  tierMeta: TierMeta | null;
  isReplanning: boolean;
  finalReport: string | null;
  coveragePct: number | null;
};

const REPLAN_RE = /\[Foreman\].*re-invoking Architect.*revise/i;
const TIER_ANNOUNCE_RE = /\[Foreman\] Complexity tier:\s*(\w+)\s*\(Tier (\d+)\)(?:\s*\(([^)]+)\))?/i;

export function parsePipelineMeta(messages: TaskMessage[]): PipelineMeta {
  let tierMeta: TierMeta | null = null;
  let isReplanning = false;
  let finalReport: string | null = null;
  let coveragePct: number | null = null;

  for (const msg of messages) {
    const text = getTextContent(msg);
    if (!text) continue;

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
          riskFlags: risksMatch
            ? risksMatch[1].split(/,\s*/).map(s => s.trim()).filter(Boolean)
            : [],
        };
      }
    }

    if (REPLAN_RE.test(text)) isReplanning = true;
    if (/\[Architect\] Revised plan/.test(text) || /\[Architect\] Plan ready/.test(text)) {
      isReplanning = false;
    }

    if (text.includes('## Swarm Factory Report')) {
      finalReport = text;
      const covMatch = text.match(/Coverage:\s*([\d.]+)%/i);
      if (covMatch) coveragePct = parseFloat(covMatch[1]);
    }
  }

  return { tierMeta, isReplanning, finalReport, coveragePct };
}
