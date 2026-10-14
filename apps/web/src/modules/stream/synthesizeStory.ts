import type { TaskSseEvent } from "../../services/gantry/types";
import {
  extractMessageText,
  isControlMessage,
  seatFromText,
  stripSeatPrefix,
} from "./messageText";
import type { StreamRow } from "./useTaskEventStream";

export type StoryBeat = {
  id: string;
  actor: string;
  /** Plain-language outcome — not a raw log line */
  headline: string;
  detail?: string;
  state: "done" | "active" | "blocked" | "warn";
};

export type TrackChain = {
  id: string;
  name: string;
  status: "planned" | "dropped" | "running" | "done";
  detail?: string;
};

export type ThreadItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "system"; id: string; text: string }
  | { kind: "story"; id: string; beats: StoryBeat[]; waitingOnYou: boolean }
  | { kind: "tracks"; id: string; tracks: TrackChain[] };

type RawLine = { id: string; seat: string; text: string };

function normalizeSeat(seat: string | null, text: string): string {
  if (seat && seat.toLowerCase() !== "firm") return seat;
  if (/swarm factory activated/i.test(text) || /complexity tier/i.test(text)) {
    return "Foreman";
  }
  return seat || "Foreman";
}

function collectLines(rows: StreamRow[]): RawLine[] {
  const out: RawLine[] = [];
  for (const row of rows) {
    const ev = row.event as TaskSseEvent;
    if (ev.type !== "message") continue;
    const raw = extractMessageText(ev.message);
    if (!raw || isControlMessage(raw)) continue;
    const seat = normalizeSeat(seatFromText(raw), raw);
    const body = stripSeatPrefix(raw).trim();
    if (!body) continue;
    for (const [i, line] of body.split("\n").map((l) => l.trim()).filter(Boolean).entries()) {
      if (/^Goal:/i.test(line)) continue; // already the user bubble
      out.push({ id: `${row.id}:${i}`, seat, text: line });
    }
  }
  return out;
}

function parseTracks(lines: RawLine[]): TrackChain[] {
  const tracks = new Map<string, TrackChain>();
  for (const { text } of lines) {
    const dropped = text.match(/track\(s\)\s+dropped[^:]*:\s*([^.]+)/i);
    if (dropped) {
      for (const name of dropped[1]
        .split(/,|\sand\s/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        tracks.set(name, {
          id: `drop-${name}`,
          name,
          status: "dropped",
          detail: "Removed — no valid steps for builders",
        });
      }
    }
    const planned = text.match(/(\d+)\s+track\(s\)\s+planned/i);
    if (planned) {
      const n = Number(planned[1]);
      const steps = text.match(/(\d+)\s+steps?/i)?.[1];
      const stack = text.match(/stack:\s*([^,]+)/i)?.[1]?.trim();
      const usefulStack = stack && !/unknown/i.test(stack) ? stack : null;
      for (let i = 0; i < n; i++) {
        const name = n === 1 ? "Primary track" : `Track ${i + 1}`;
        if (!tracks.has(name)) {
          tracks.set(name, {
            id: `plan-${name}`,
            name,
            status: "planned",
            detail: [usefulStack, steps ? `${steps} builder step${steps === "1" ? "" : "s"}` : null]
              .filter(Boolean)
              .join(" · ") || "Ready after you approve",
          });
        }
      }
    }
  }
  return [...tracks.values()];
}

function repoLabel(text: string): string | null {
  const m = text.match(/Repo:\s*(\S+)/i);
  if (!m) return null;
  const path = m[1];
  const base = path.split("/").filter(Boolean).pop() || path;
  return base;
}

function branchLabel(text: string): string | null {
  const m = text.match(/Branch:\s*(\S+)/i);
  return m?.[1] ?? null;
}

/**
 * Turn noisy swarm logs into a short engagement story a partner can read.
 */
export function synthesizeStory(
  rows: StreamRow[],
  goal: string | null | undefined,
  localUser: { id: string; text: string }[],
  waitingOnYou: boolean,
): ThreadItem[] {
  const items: ThreadItem[] = [];
  if (goal) items.push({ kind: "user", id: "goal", text: goal });

  const lines = collectLines(rows);
  const beats: StoryBeat[] = [];

  let tierLine: string | null = null;
  let boundRepo: string | null = null;
  let boundBranch: string | null = null;
  let pmActive = false;
  let pmDone = false;
  let archActive = false;
  let archDone = false;
  let archSummary: string | null = null;
  let dropNote: string | null = null;

  for (const line of lines) {
    const t = line.text;

    const tier = t.match(/Complexity tier:\s*([^(—-]+)\s*[—(]\s*Tier\s*(\d+)[^)]*\)\s*—\s*(.+)$/i)
      || t.match(/Complexity tier:\s*(.+)$/i);
    if (tier) {
      if (tier.length >= 4) {
        tierLine = `${tier[1].trim()} (Tier ${tier[2]}) — ${tier[3].trim()}`;
      } else {
        tierLine = tier[1].trim();
      }
      continue;
    }

    if (/swarm factory activated/i.test(t) || /^Repo:/i.test(t) || /Branch:/i.test(t)) {
      boundRepo = repoLabel(t) || boundRepo;
      boundBranch = branchLabel(t) || boundBranch;
      // Also handle "Swarm Factory activated. · Repo: ..."
      const inlineRepo = t.match(/Repo:\s*(\S+)/i);
      const inlineBranch = t.match(/Branch:\s*(\S+)/i);
      if (inlineRepo) boundRepo = inlineRepo[1].split("/").filter(Boolean).pop() || inlineRepo[1];
      if (inlineBranch) boundBranch = inlineBranch[1];
      continue;
    }

    if (/dispatching\s+pm/i.test(t)) {
      pmActive = true;
      continue;
    }
    if (line.seat.toLowerCase() === "pm") {
      pmActive = true;
      if (/\bdone\b|✓/i.test(t)) pmDone = true;
      continue;
    }

    if (/dispatching\s+architect/i.test(t)) {
      archActive = true;
      if (pmActive) pmDone = true;
      continue;
    }
    if (line.seat.toLowerCase().includes("architect")) {
      archActive = true;
      if (pmActive) pmDone = true;
      const planned = t.match(/(\d+)\s+track\(s\)\s+planned/i);
      if (planned || /\bdone\b|✓/i.test(t)) {
        archDone = true;
        const n = planned?.[1] || "1";
        const steps = t.match(/(\d+)\s+steps?/i)?.[1];
        archSummary = steps
          ? `Planned ${n} work chain${n === "1" ? "" : "s"} (${steps} step${steps === "1" ? "" : "s"} total)`
          : `Planned ${n} work chain${n === "1" ? "" : "s"}`;
      }
      continue;
    }

    if (/track\(s\)\s+dropped/i.test(t)) {
      const names = t.match(/:\s*([^.]+)/)?.[1]?.trim();
      dropNote = names
        ? `Dropped ${names} — not enough concrete steps to build`
        : "Dropped a track that had no valid steps";
      continue;
    }
  }

  // Terminal events
  for (const row of rows) {
    const ev = row.event as TaskSseEvent;
    if (ev.type === "error") {
      items.push({ kind: "system", id: row.id, text: ev.message });
    } else if (ev.type === "done") {
      items.push({
        kind: "system",
        id: row.id,
        text: `Engagement ${ev.status.replace(/_/g, " ").toLowerCase()}`,
      });
    }
  }

  if (tierLine || boundRepo) {
    const bits = [
      tierLine ? `Staffed as ${tierLine}` : "Staffed the engagement",
      boundRepo ? `on ${boundRepo}` : null,
      boundBranch ? `(${boundBranch})` : null,
    ].filter(Boolean);
    beats.push({
      id: "staff",
      actor: "Foreman",
      headline: bits.join(" "),
      detail: "Foreman set autonomy and opened the factory run",
      state: "done",
    });
  }

  if (pmActive || archActive || archDone) {
    beats.push({
      id: "pm",
      actor: "PM",
      headline: pmDone || archActive || archDone
        ? "Reviewed the brief and scanned the repo for gaps"
        : "Reviewing the brief and scanning the repo",
      detail: "Checks the goal is clear before Architect plans tracks",
      state: pmDone || archActive || archDone ? "done" : "active",
    });
  }

  if (archActive || archDone) {
    beats.push({
      id: "arch",
      actor: "Architect",
      headline: archDone
        ? archSummary || "Finished the build plan"
        : "Mapping the repo into parallel build tracks",
      detail: dropNote || "Decomposes the job so Builders can run in parallel",
      state: waitingOnYou && archDone ? "blocked" : archDone ? "done" : "active",
    });
  }

  if (waitingOnYou && archDone) {
    beats.push({
      id: "gate",
      actor: "You",
      headline: "Approve the plan so Builders can start",
      detail: "Partner gate — nothing ships until you decide",
      state: "blocked",
    });
  }

  if (beats.length) {
    items.push({
      kind: "story",
      id: "story",
      beats,
      waitingOnYou,
    });
  }

  const tracks = parseTracks(lines);
  if (tracks.length) {
    items.push({ kind: "tracks", id: "tracks", tracks });
  }

  for (const u of localUser) {
    if (!items.some((it) => it.kind === "user" && it.id === u.id)) {
      items.push({ kind: "user", id: u.id, text: u.text });
    }
  }

  return items;
}
