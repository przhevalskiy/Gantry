/**
 * Thin Gantry /v1 client. No orchestration in the browser (I8).
 * Wire real calls in later slices.
 */

const baseUrl = () =>
  (import.meta.env.VITE_GANTRY_API_URL || "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = baseUrl();
  return base ? `${base}${p}` : p;
}

export async function gantryFetch(
  path: string,
  init: RequestInit & { apiKey?: string } = {},
): Promise<Response> {
  const { apiKey, headers, ...rest } = init;
  const h = new Headers(headers);
  if (apiKey) h.set("Authorization", `Bearer ${apiKey}`);
  if (!h.has("Content-Type") && rest.body) {
    h.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(path), { ...rest, headers: h });
}
