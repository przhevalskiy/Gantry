export interface TrackerHit {
  id: string;
  label: string;
  category: 'ads' | 'analytics' | 'social' | 'tagmgr' | 'other';
  evidence: string;
}

/** Known third-party patterns — POC list, not exhaustive. */
export const TRACKER_PATTERNS: { id: string; label: string; category: TrackerHit['category']; re: RegExp }[] = [
  { id: 'ga', label: 'Google Analytics', category: 'analytics', re: /google-analytics\.com|googletagmanager\.com\/gtag|gtag\s*\(/i },
  { id: 'gtm', label: 'Google Tag Manager', category: 'tagmgr', re: /googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/i },
  { id: 'fb', label: 'Meta Pixel', category: 'ads', re: /connect\.facebook\.net|fbq\s*\(/i },
  { id: 'tt', label: 'TikTok Pixel', category: 'ads', re: /analytics\.tiktok\.com|ttq\.load/i },
  { id: 'tw', label: 'X / Twitter pixel', category: 'ads', re: /static\.ads-twitter\.com|twq\s*\(/i },
  { id: 'li', label: 'LinkedIn Insight', category: 'ads', re: /snap\.licdn\.com|linkedin\.com\/px/i },
  { id: 'hotjar', label: 'Hotjar', category: 'analytics', re: /static\.hotjar\.com|hotjar/i },
  { id: 'mixpanel', label: 'Mixpanel', category: 'analytics', re: /cdn\.mxpnl\.com|mixpanel/i },
  { id: 'segment', label: 'Segment', category: 'analytics', re: /cdn\.segment\.com|analytics\.load/i },
  { id: 'clarity', label: 'Microsoft Clarity', category: 'analytics', re: /clarity\.ms/i },
  { id: 'cookiebot', label: 'Cookiebot', category: 'other', re: /consent\.cookiebot\.com/i },
  { id: 'onetrust', label: 'OneTrust', category: 'other', re: /cdn\.cookielaw\.org|onetrust/i },
];

export function scanTrackersFromHtml(html: string, scriptSrcs: string[]): TrackerHit[] {
  const blob = html + '\n' + scriptSrcs.join('\n');
  const hits: TrackerHit[] = [];
  for (const p of TRACKER_PATTERNS) {
    const m = blob.match(p.re);
    if (m) {
      hits.push({
        id: p.id,
        label: p.label,
        category: p.category,
        evidence: (m[0] || '').slice(0, 80),
      });
    }
  }
  return hits;
}

/** Page-world scanner for executeScript */
export function scanPageTrackers(): {
  url: string;
  title: string;
  hits: { id: string; label: string; category: string; evidence: string }[];
} {
  const patterns: { id: string; label: string; category: string; re: RegExp }[] = [
    { id: 'ga', label: 'Google Analytics', category: 'analytics', re: /google-analytics\.com|googletagmanager\.com\/gtag|gtag\s*\(/i },
    { id: 'gtm', label: 'Google Tag Manager', category: 'tagmgr', re: /googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/i },
    { id: 'fb', label: 'Meta Pixel', category: 'ads', re: /connect\.facebook\.net|fbq\s*\(/i },
    { id: 'tt', label: 'TikTok Pixel', category: 'ads', re: /analytics\.tiktok\.com|ttq\.load/i },
    { id: 'tw', label: 'X / Twitter pixel', category: 'ads', re: /static\.ads-twitter\.com|twq\s*\(/i },
    { id: 'li', label: 'LinkedIn Insight', category: 'ads', re: /snap\.licdn\.com|linkedin\.com\/px/i },
    { id: 'hotjar', label: 'Hotjar', category: 'analytics', re: /static\.hotjar\.com|hotjar/i },
    { id: 'mixpanel', label: 'Mixpanel', category: 'analytics', re: /cdn\.mxpnl\.com|mixpanel/i },
    { id: 'segment', label: 'Segment', category: 'analytics', re: /cdn\.segment\.com|analytics\.load/i },
    { id: 'clarity', label: 'Microsoft Clarity', category: 'analytics', re: /clarity\.ms/i },
    { id: 'cookiebot', label: 'Cookiebot', category: 'other', re: /consent\.cookiebot\.com/i },
    { id: 'onetrust', label: 'OneTrust', category: 'other', re: /cdn\.cookielaw\.org|onetrust/i },
  ];
  const html = document.documentElement.innerHTML.slice(0, 400000);
  const scriptSrcs = Array.from(document.scripts)
    .map((s) => s.src || '')
    .filter(Boolean);
  const blob = html + '\n' + scriptSrcs.join('\n');
  const hits: { id: string; label: string; category: string; evidence: string }[] = [];
  for (const p of patterns) {
    const m = blob.match(p.re);
    if (m) hits.push({ id: p.id, label: p.label, category: p.category, evidence: String(m[0]).slice(0, 80) });
  }
  return { url: location.href, title: document.title, hits };
}
