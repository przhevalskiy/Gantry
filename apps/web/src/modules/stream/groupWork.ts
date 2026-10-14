import type { TaskSseEvent } from "../../services/gantry/types";
import {
  extractMessageText,
  isControlMessage,
  seatFromText,
  stripSeatPrefix,
} from "./messageText";
import type { StreamRow } from "./useTaskEventStream";

export type Exchange = {
  id: string;
  /** Speaker seat */
  from: string;
  /** If Foreman is dispatching someone */
  to: string | null;
  kind: "dispatch" | "speak" | "note";
  text: string;
  tone: "info" | "warn" | "done";
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
  | { kind: "crew"; id: string; exchanges: Exchange[]; status: "running" | "blocked" | "done" }
  | { kind: "tracks"; id: string; tracks: TrackChain[] };

function toneOf(text: string): Exchange["tone"] {
  if (text.includes("⚠") || /dropped|fail|error/i.test(text)) return "warn";
  if (text.includes("✓") || /\bdone\b/i.test(text)) return "done";
  return "info";
}

function parseDispatch(text: string): { to: string; rest: string } | null {
  const m = text.match(/^Dispatching\s+([^—\-]+)[—\-]\s*(.*)$/i);
  if (!m) return null;
  return { to: m[1].trim(), rest: m[2].trim() };
}

function ingestTracks(text: string, into: Map<string, TrackChain>): void {
  const dropped = text.match(/track\(s\)\s+dropped[^:]*:\s*([^.]+)/i);
  if (dropped) {
    for (const name of dropped[1].split(/,|\sand\s/).map((s) => s.trim()).filter(Boolean)) {
      into.set(name, {
        id: `drop-${name}`,
        name,
        status: "dropped",
        detail: "No valid steps",
      });
    }
  }

  const planned = text.match(/(\d+)\s+track\(s\)\s+planned/i);
  if (planned) {
    const n = Number(planned[1]);
    const stack = text.match(/stack:\s*([^,]+)/i)?.[1]?.trim();
    const steps = text.match(/(\d+)\s+steps?/i)?.[1];
    // If we only know a count, synthesize placeholders for unnamed tracks
    const existingPlanned = [...into.values()].filter((t) => t.status === "planned").length;
    for (let i = existingPlanned; i < n; i++) {
      const name = n === 1 ? "Primary track" : `Track ${i + 1}`;
      if (!into.has(name)) {
        into.set(name, {
          id: `plan-${name}`,
          name,
          status: "planned",
          detail: [stack && stack !== "unknown stack" ? stack : null, steps ? `${steps} steps` : null]
            .filter(Boolean)
            .join(" · ") || "Awaiting approval",
        });
      }
    }
  }

  // "3 track(s)" in complexity line — capacity, not concrete chains yet
}

/**
 * Build a crew-dialogue + track-chain model from SSE rows.
 * Shows who speaks to whom, and which parallel chains exist.
 */
export function groupRowsIntoThread(
  rows: StreamRow[],
  goal: string | null | undefined,
  localUser: { id: string; text: string }[],
  blocked: boolean,
  terminal: boolean,
): ThreadItem[] {
  const items: ThreadItem[] = [];
  if (goal) items.push({ kind: "user", id: "goal", text: goal });

  const exchanges: Exchange[] = [];
  const tracks = new Map<string, TrackChain>();

  for (const row of rows) {
    const ev = row.event as TaskSseEvent;
    if (ev.type === "message") {
      const raw = extractMessageText(ev.message);
      if (!raw || isControlMessage(raw)) continue;
      const seat = seatFromText(raw) || "Firm";
      const body = stripSeatPrefix(raw).trim();
      if (!body) continue;

      ingestTracks(body, tracks);

      const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
      const isForeman = seat.toLowerCase().includes("foreman");

      if (isForeman && lines.length > 1) {
        // Activation block → one note, skip Goal: echo
        const kept = lines.filter((l) => !l.startsWith("Goal:"));
        const dispatchLine = kept.find((l) => /^Dispatching\s+/i.test(l));
        if (dispatchLine) {
          for (const line of kept) {
            pushExchange(exchanges, row.id + line, seat, line);
          }
        } else {
          exchanges.push({
            id: row.id,
            from: seat,
            to: null,
            kind: "note",
            text: kept.map((l) => l.replace(/^Repo:\s*/, "Repo ")).join(" · "),
            tone: toneOf(body),
          });
        }
        continue;
      }

      pushExchange(exchanges, row.id, seat, body);
    } else if (ev.type === "error") {
      items.push({ kind: "system", id: row.id, text: ev.message });
    } else if (ev.type === "done") {
      items.push({
        kind: "system",
        id: row.id,
        text: `Engagement ${ev.status.replace(/_/g, " ").toLowerCase()}`,
      });
    }
  }

  if (exchanges.length) {
    items.push({
      kind: "crew",
      id: "crew",
      exchanges,
      status: terminal ? "done" : blocked ? "blocked" : "running",
    });
  }

  if (tracks.size) {
    items.push({
      kind: "tracks",
      id: "tracks",
      tracks: [...tracks.values()],
    });
  }

  for (const u of localUser) {
    if (!items.some((it) => it.kind === "user" && it.id === u.id)) {
      items.push({ kind: "user", id: u.id, text: u.text });
    }
  }

  return items;
}

function pushExchange(
  exchanges: Exchange[],
  id: string,
  seat: string,
  body: string,
): void {
  const dispatch = parseDispatch(body);
  if (seat.toLowerCase().includes("foreman") && dispatch) {
    exchanges.push({
      id,
      from: seat,
      to: dispatch.to,
      kind: "dispatch",
      text: dispatch.rest || body,
      tone: toneOf(body),
    });
    return;
  }
  exchanges.push({
    id,
    from: seat,
    to: null,
    kind: toneOf(body) === "warn" ? "note" : "speak",
    text: body,
    tone: toneOf(body),
  });
}
