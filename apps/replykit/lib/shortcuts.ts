export function normalizeShortcut(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith(';') ? trimmed : `;${trimmed}`;
}
