/**
 * Thin Gantry /v1 client. No orchestration in the browser (I8 / C1).
 * All product actions are REST against the control plane.
 */

import { getApiKey } from "./auth";
import {
  GantryApiError,
  type AgentsCatalog,
  type FirmPack,
  type HitlDecideBody,
  type HitlDecideResponse,
  type PlaybookBrief,
  type Project,
  type SubmitTaskBody,
  type SubmitTaskResponse,
  type Task,
  type TaskSseEvent,
} from "./types";

const baseUrl = () =>
  (import.meta.env.VITE_GANTRY_API_URL || "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = baseUrl();
  return base ? `${base}${p}` : p;
}

export async function gantryFetch(
  path: string,
  init: RequestInit & { apiKey?: string | null } = {},
): Promise<Response> {
  const { apiKey, headers, ...rest } = init;
  const h = new Headers(headers);
  const key = apiKey === undefined ? getApiKey() : apiKey;
  if (key) h.set("Authorization", `Bearer ${key}`);
  if (!h.has("Content-Type") && rest.body) {
    h.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(path), { ...rest, headers: h });
}

async function parseDetail(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown };
    if (typeof data.detail === "string") return data.detail;
    if (data.detail != null) return JSON.stringify(data.detail);
  } catch {
    /* ignore */
  }
  return res.statusText || `HTTP ${res.status}`;
}

async function expectOk<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new GantryApiError(res.status, await parseDetail(res));
  }
  return (await res.json()) as T;
}

/** GET /v1/projects */
export async function listProjects(): Promise<Project[]> {
  const res = await gantryFetch("/v1/projects");
  const data = await expectOk<{ projects: Project[] }>(res);
  return data.projects ?? [];
}

/** POST /v1/projects */
export async function createProject(body: {
  name: string;
  github_url?: string | null;
}): Promise<Project> {
  const res = await gantryFetch("/v1/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await expectOk<{ project: Project }>(res);
  return data.project;
}

/** POST /v1/tasks — file a work order (P1) */
export async function submitTask(body: SubmitTaskBody): Promise<SubmitTaskResponse> {
  const res = await gantryFetch("/v1/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return expectOk<SubmitTaskResponse>(res);
}

/** GET /v1/tasks/{id} */
export async function getTask(taskId: string): Promise<Task> {
  const res = await gantryFetch(`/v1/tasks/${encodeURIComponent(taskId)}`);
  return expectOk<Task>(res);
}

/** GET /v1/tasks — org matter list */
export async function listTasks(limit = 50): Promise<Task[]> {
  const res = await gantryFetch(`/v1/tasks?limit=${encodeURIComponent(String(limit))}`);
  const data = await expectOk<{ tasks: Task[]; count: number }>(res);
  return data.tasks ?? [];
}

function parseSseFrame(frame: string): TaskSseEvent | null {
  const line = frame.split("\n").find((l) => l.startsWith("data: "));
  if (!line) return null;
  try {
    const payload = JSON.parse(line.slice(6)) as TaskSseEvent;
    if (!payload || typeof payload !== "object" || !("type" in payload)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** POST /v1/tasks/{id}/hitl — partner decision (C3 audit on server). */
export async function decideHitl(
  taskId: string,
  body: HitlDecideBody,
): Promise<HitlDecideResponse> {
  const res = await gantryFetch(`/v1/tasks/${encodeURIComponent(taskId)}/hitl`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return expectOk<HitlDecideResponse>(res);
}

/** GET /v1/agents — Operator directory (Temporal seats; one ACP swarm-factory). */
export async function listAgents(): Promise<AgentsCatalog> {
  const res = await gantryFetch("/v1/agents");
  return expectOk<AgentsCatalog>(res);
}

/** GET /v1/packs — firm practices catalog. */
export async function listPacks(): Promise<FirmPack[]> {
  const res = await gantryFetch("/v1/packs");
  const data = await expectOk<{ packs: FirmPack[] }>(res);
  return data.packs ?? [];
}

/** POST /v1/packs/{ref}/install — put practice on retainer. */
export async function installPack(packRef: string): Promise<FirmPack> {
  const res = await gantryFetch(
    `/v1/packs/${encodeURIComponent(packRef)}/install`,
    { method: "POST", body: JSON.stringify({}) },
  );
  const data = await expectOk<{ pack: FirmPack }>(res);
  return data.pack;
}

/** PATCH /v1/packs/{ref} — enable / disable practice. */
export async function updatePack(
  packRef: string,
  body: { enabled?: boolean; max_tasks_per_day?: number },
): Promise<FirmPack> {
  const res = await gantryFetch(`/v1/packs/${encodeURIComponent(packRef)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const data = await expectOk<{ pack: FirmPack }>(res);
  return data.pack;
}

/** GET /v1/playbooks — engagement briefs. */
export async function listPlaybooks(): Promise<PlaybookBrief[]> {
  const res = await gantryFetch("/v1/playbooks");
  const data = await expectOk<{ playbooks: PlaybookBrief[] }>(res);
  return data.playbooks ?? [];
}

/**
 * GET /v1/tasks/{id}/events — SSE via fetch (Bearer auth; EventSource cannot set Authorization).
 * Yields until `done`/`error`, abort, or stream end. Observability only — prefer GET task result (I3).
 */
export async function* streamTaskEvents(
  taskId: string,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<TaskSseEvent, void, unknown> {
  const res = await gantryFetch(`/v1/tasks/${encodeURIComponent(taskId)}/events`, {
    headers: { Accept: "text/event-stream" },
    signal: options.signal,
  });
  if (!res.ok) {
    throw new GantryApiError(res.status, await parseDetail(res));
  }
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body for SSE stream");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (options.signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const event = parseSseFrame(frame);
        if (!event) continue;
        yield event;
        if (event.type === "done" || event.type === "error") {
          return;
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
}
