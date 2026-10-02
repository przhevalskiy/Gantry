import type { SiteId } from './types';

export function siteFromHost(host: string): SiteId | null {
  const h = host.toLowerCase();
  if (h.includes('youtube.com')) return 'youtube';
  if (h.includes('instagram.com')) return 'instagram';
  if (h === 'x.com' || h.endsWith('.x.com') || h.includes('twitter.com')) return 'x';
  return null;
}

/** CSS rules applied when a site toggle is on. Hide, don't delete. */
export const SITE_CSS: Record<SiteId, string> = {
  youtube: `
ytd-rich-shelf-renderer:has(a[href*="/shorts/"]),
ytd-reel-shelf-renderer,
ytd-mini-guide-entry-renderer:has(a[title="Shorts"]),
ytd-guide-entry-renderer:has(a[title="Shorts"]),
ytd-guide-entry-renderer:has(a[href*="/shorts"]),
ytm-pivot-bar-item-renderer:has(a[href*="/shorts"]),
ytd-video-renderer:has(a[href*="/shorts/"]),
ytd-grid-video-renderer:has(a[href*="/shorts/"]),
ytd-rich-item-renderer:has(a[href*="/shorts/"]),
ytd-reel-item-renderer,
[is-shorts],
ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"] {
  display: none !important;
}
`,
  instagram: `
a[href="/reels/"],
a[href*="/reels/"],
div:has(> a[href="/reels/"]),
[role="menuitem"]:has(a[href*="/reels"]),
section:has(a[href*="/reels/"]) svg[aria-label="Reels"] {
  /* structural hooks vary; JS also marks data-feedkill */
}
[data-feedkill="hide"] {
  display: none !important;
}
`,
  x: `
[data-testid="primaryColumn"] a[href="/home"] ~ div,
a[href="/i/grok"],
[data-testid="sidebarColumn"] {
  /* keep structure; JS marks For You tab + explore distractors */
}
[data-feedkill="hide"] {
  display: none !important;
}
`,
};

export function youtubeShortsWatchId(pathname: string): string | null {
  const m = pathname.match(/^\/shorts\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}
