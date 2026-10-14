/** Tiny display helpers — no business logic. */

export function formatStatus(status: string | undefined | null): string {
  if (!status) return "unknown";
  return status.replace(/_/g, " ").toLowerCase();
}

export function formatWhen(iso: string | undefined | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return new Date(t).toLocaleDateString();
}
