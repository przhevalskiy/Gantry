/**
 * Thin Gantry /v1 client. No orchestration in the browser (I8 / C1).
 * All product actions are REST against the control plane.
 */

import { getApiKey } from "./auth";
import {
  GantryApiError,
  type Project,
  type SubmitTaskBody,
  type SubmitTaskResponse,
  type Task,
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
