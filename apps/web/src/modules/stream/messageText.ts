import type { TaskSseMessage } from "../../services/gantry/types";

/** Pull plain text out of Agentex/SSE message payloads. */
export function extractMessageText(message: TaskSseMessage): string {
  const raw = message.content;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed) as { content?: unknown };
        if (typeof parsed.content === "string") return parsed.content;
      } catch {
        /* keep raw */
      }
    }
    return raw;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as { content?: unknown; text?: unknown };
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.text === "string") return obj.text;
  }
  if (raw == null) return "";
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

export function isControlMessage(text: string): boolean {
  return (
    text.startsWith("__approval_request__") ||
    text.startsWith("__approval_resolved__")
  );
}

/** Optional seat label from “[Foreman] …” / “[PM] …” prefixes. */
export function seatFromText(text: string): string | null {
  const m = text.match(/^\[([^\]]+)\]\s*/);
  return m?.[1] ?? null;
}

export function stripSeatPrefix(text: string): string {
  return text.replace(/^\[[^\]]+\]\s*/, "");
}
