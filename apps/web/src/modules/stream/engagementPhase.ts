import type { PendingHitl, TaskResult } from "../../services/gantry/types";
import {
  extractMessageText,
  isControlMessage,
  seatFromText,
  stripSeatPrefix,
} from "./messageText";
import type { StreamRow } from "./useTaskEventStream";

/** Single source of truth for what the engagement UI should claim. */
export type EngagementPhase =
  | "staffing"
  | "clarifying"
  | "planning"
  | "awaiting_you"
  | "building"
  | "verifying"
  | "shipping"
  | "completed"
  | "failed";

export type PhaseView = {
  phase: EngagementPhase;
  /** Short header chip, e.g. "Building" */
  label: string;
  /** One sentence under the floor */
  caption: string;
  waitingOnYou: boolean;
  terminal: boolean;
  /** Show artifact climax */
  showDeliverable: boolean;
  /** Track board subtitle */
  chainsCaption: string;
  /** How planned (non-dropped) tracks should display */
  activeTrackStatus: "queued" | "running" | "done";
};

const TERMINAL_OK = new Set(["completed"]);
const TERMINAL_BAD = new Set(["failed", "cancelled", "terminated", "timeout"]);

function hasMeaningfulDeliverable(result: TaskResult | null | undefined): boolean {
  if (!result) return false;
  if (typeof result.pr_url === "string" && result.pr_url) return true;
  if (typeof result.artifact_type === "string" && result.artifact_type) return true;
  // Branch alone is often set at kickoff — only treat as deliverable when terminal
  return false;
}

function scanProgress(rows: StreamRow[]) {
  let pm = false;
  let arch = false;
  let archDone = false;
  let builder = false;
  let inspector = false;
  let devops = false;

  for (const row of rows) {
    if (row.event.type !== "message") continue;
    const raw = extractMessageText(row.event.message);
    if (!raw || isControlMessage(raw)) continue;
    const seat = (seatFromText(raw) || "").toLowerCase();
    const text = stripSeatPrefix(raw);

    if (/dispatching\s+pm/i.test(text) || seat === "pm") pm = true;
    if (/dispatching\s+architect/i.test(text) || seat.includes("architect")) {
      arch = true;
      if (/\bdone\b|✓|track\(s\)\s+planned/i.test(text)) archDone = true;
    }
    if (/dispatching\s+builder/i.test(text) || seat.includes("builder")) builder = true;
    if (
      /dispatching\s+inspector/i.test(text) ||
      seat.includes("inspector") ||
      seat.includes("reviewer")
    ) {
      inspector = true;
    }
    if (/dispatching\s+devops/i.test(text) || seat.includes("devops")) devops = true;
  }

  return { pm, arch, archDone, builder, inspector, devops };
}

export function derivePhaseView(input: {
  status: string | null | undefined;
  pendingHitl: PendingHitl[];
  result: TaskResult | null | undefined;
  rows: StreamRow[];
}): PhaseView {
  const status = (input.status || "").toLowerCase();
  const waitingOnYou =
    input.pendingHitl.length > 0 || status === "waiting_approval";
  const progress = scanProgress(input.rows);
  const richDeliverable = hasMeaningfulDeliverable(input.result);
  const branchOnly =
    !!input.result &&
    typeof input.result.branch === "string" &&
    !!input.result.branch &&
    !richDeliverable;

  if (TERMINAL_OK.has(status)) {
    return {
      phase: "completed",
      label: "Completed",
      caption: "Engagement closed — deliverable is ready",
      waitingOnYou: false,
      terminal: true,
      showDeliverable: richDeliverable || branchOnly,
      chainsCaption: "Final builder chains for this engagement",
      activeTrackStatus: "done",
    };
  }

  if (TERMINAL_BAD.has(status)) {
    return {
      phase: "failed",
      label: status.replace(/_/g, " "),
      caption: "Engagement stopped before a clean close",
      waitingOnYou: false,
      terminal: true,
      showDeliverable: richDeliverable,
      chainsCaption: "Chains at the time the run stopped",
      activeTrackStatus: "done",
    };
  }

  if (waitingOnYou) {
    return {
      phase: "awaiting_you",
      label: "Waiting on you",
      caption: "Partner approval needed before the next seat runs",
      waitingOnYou: true,
      terminal: false,
      showDeliverable: false,
      chainsCaption: "What will run in parallel after you approve",
      activeTrackStatus: "queued",
    };
  }

  if (progress.devops) {
    return {
      phase: "shipping",
      label: "Shipping",
      caption: "DevOps is closing the engagement",
      waitingOnYou: false,
      terminal: false,
      showDeliverable: richDeliverable,
      chainsCaption: "Builder chains in this engagement",
      activeTrackStatus: "done",
    };
  }

  if (progress.inspector) {
    return {
      phase: "verifying",
      label: "Verifying",
      caption: "Inspector / Reviewer checking the work",
      waitingOnYou: false,
      terminal: false,
      showDeliverable: false,
      chainsCaption: "Builder chains under review",
      activeTrackStatus: "done",
    };
  }

  if (progress.builder || (progress.archDone && !waitingOnYou)) {
    return {
      phase: "building",
      label: "Building",
      caption: progress.builder
        ? "Builders are executing the planned chains"
        : "Plan cleared — Builders can run (no partner gate on this tier)",
      waitingOnYou: false,
      terminal: false,
      showDeliverable: false,
      chainsCaption: "Chains in flight",
      activeTrackStatus: "running",
    };
  }

  if (progress.arch) {
    return {
      phase: "planning",
      label: "Planning",
      caption: "Architect is turning the brief into builder chains",
      waitingOnYou: false,
      terminal: false,
      showDeliverable: false,
      chainsCaption: "Chains appear when the Architect finishes",
      activeTrackStatus: "queued",
    };
  }

  if (progress.pm) {
    return {
      phase: "clarifying",
      label: "Clarifying",
      caption: "PM is reviewing the brief against the repo",
      waitingOnYou: false,
      terminal: false,
      showDeliverable: false,
      chainsCaption: "No builder chains yet",
      activeTrackStatus: "queued",
    };
  }

  return {
    phase: "staffing",
    label: "Staffing",
    caption: "Foreman is opening the engagement",
    waitingOnYou: false,
    terminal: false,
    showDeliverable: false,
    chainsCaption: "No builder chains yet",
    activeTrackStatus: "queued",
  };
}
