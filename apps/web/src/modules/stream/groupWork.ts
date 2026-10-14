import type { TaskSseEvent } from "../../services/gantry/types";
import {
  extractMessageText,
  isControlMessage,
  seatFromText,
  stripSeatPrefix,
} from "./messageText";
import type { StreamRow } from "./useTaskEventStream";

export type WorkStep = {
  id: string;
  seat: string | null;
  text: string;
  tone: "info" | "warn" | "done";
};

export type WorkStage = {
  id: string;
  title: string;
  status: "running" | "done" | "blocked";
  steps: WorkStep[];
};

export type ThreadItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "system"; id: string; text: string }
  | { kind: "stage"; stage: WorkStage };

function stageForSeat(seat: string | null, text: string): string {
  const s = (seat || "").toLowerCase();
  const t = text.toLowerCase();

  if (t.includes("dispatching builder") || s.includes("builder")) return "build";
  if (t.includes("dispatching inspector") || s.includes("inspector")) return "verify";
  if (t.includes("dispatching reviewer") || s.includes("reviewer")) return "verify";
  if (t.includes("dispatching security") || s.includes("security")) return "secure";
  if (t.includes("dispatching devops") || s.includes("devops")) return "ship";
  if (
    t.includes("dispatching architect") ||
    s.includes("architect") ||
    t.includes("track(s) planned") ||
    t.includes("track(s) dropped")
  ) {
    return "plan";
  }
  if (
    t.includes("dispatching pm") ||
    s === "pm" ||
    t.includes("scanning repository") ||
    t.includes("checking for ambiguities")
  ) {
    return "clarify";
  }
  if (
    t.includes("complexity tier") ||
    t.includes("swarm factory activated") ||
    t.startsWith("goal:") ||
    t.startsWith("repo:")
  ) {
    return "kickoff";
  }
  if (s.includes("foreman")) {
    if (t.includes("dispatching")) return "clarify";
    return "kickoff";
  }
  return "work";
}

const STAGE_TITLE: Record<string, string> = {
  kickoff: "Staffing the engagement",
  clarify: "Clarifying the brief",
  plan: "Architecting the plan",
  build: "Building",
  verify: "Verifying",
  secure: "Security review",
  ship: "Shipping",
  work: "Working",
};

function stepTone(text: string): WorkStep["tone"] {
  if (text.includes("⚠") || /dropped|fail|error/i.test(text)) return "warn";
  if (text.includes("✓") || /\bdone\b/i.test(text)) return "done";
  return "info";
}

/**
 * Collapse noisy per-action chat lines into multi-step work stages
 * (agent-turn / work-card pattern).
 */
export function groupRowsIntoThread(
  rows: StreamRow[],
  goal: string | null | undefined,
  localUser: { id: string; text: string }[],
  blocked: boolean,
): ThreadItem[] {
  const items: ThreadItem[] = [];
  if (goal) items.push({ kind: "user", id: "goal", text: goal });

  const stages = new Map<string, WorkStage>();
  const order: string[] = [];

  function ensure(key: string): WorkStage {
    let s = stages.get(key);
    if (!s) {
      s = {
        id: key,
        title: STAGE_TITLE[key] || STAGE_TITLE.work,
        status: "running",
        steps: [],
      };
      stages.set(key, s);
      order.push(key);
    }
    return s;
  }

  for (const row of rows) {
    const ev = row.event as TaskSseEvent;
    if (ev.type === "message") {
      const text = extractMessageText(ev.message);
      if (!text || isControlMessage(text)) continue;
      const seat = seatFromText(text);
      const body = stripSeatPrefix(text).trim();
      if (!body) continue;

      // Fold multi-line Foreman activation into fewer steps
      const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
      const key = stageForSeat(seat, body);
      const stage = ensure(key);

      if (
        key === "kickoff" &&
        lines.some((l) => l.startsWith("Goal:") || l.startsWith("Repo:"))
      ) {
        // One activation step instead of Goal/Repo spam
        const summary = lines
          .filter((l) => !l.startsWith("Goal:"))
          .slice(0, 2)
          .join(" · ");
        stage.steps.push({
          id: row.id,
          seat: seat || "Foreman",
          text: summary || body,
          tone: stepTone(body),
        });
      } else if (lines.length > 1 && seat?.toLowerCase().includes("foreman")) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith("Goal:")) continue;
          stage.steps.push({
            id: `${row.id}:${i}`,
            seat: seat || "Foreman",
            text: line.replace(/^Repo:\s*/, "Repo "),
            tone: stepTone(line),
          });
        }
      } else {
        stage.steps.push({
          id: row.id,
          seat,
          text: body,
          tone: stepTone(body),
        });
      }

      if (stepTone(body) === "done") stage.status = "done";
    } else if (ev.type === "error") {
      items.push({ kind: "system", id: row.id, text: ev.message });
    } else if (ev.type === "done") {
      for (const key of order) {
        const s = stages.get(key);
        if (s && s.status === "running") s.status = "done";
      }
      items.push({
        kind: "system",
        id: row.id,
        text: `Engagement ${ev.status.replace(/_/g, " ").toLowerCase()}`,
      });
    }
    // status/lifecycle/hitl: header + HITL card — not thread spam
  }

  // Mark last non-done stage blocked when HITL pending
  if (blocked) {
    for (let i = order.length - 1; i >= 0; i--) {
      const s = stages.get(order[i]);
      if (s && s.status !== "done") {
        s.status = "blocked";
        break;
      }
    }
  } else {
    // Only the last stage stays running; earlier ones settle to done
    for (let i = 0; i < order.length - 1; i++) {
      const s = stages.get(order[i]);
      if (s && s.status === "running") s.status = "done";
    }
  }

  for (const key of order) {
    const s = stages.get(key);
    if (s && s.steps.length) items.push({ kind: "stage", stage: s });
  }

  for (const u of localUser) {
    if (!items.some((it) => it.kind === "user" && it.id === u.id)) {
      items.push({ kind: "user", id: u.id, text: u.text });
    }
  }

  return items;
}
