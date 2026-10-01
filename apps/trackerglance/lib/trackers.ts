export interface TrackerHit {
  id: string;
  label: string;
  category: 'ads' | 'analytics' | 'social' | 'tagmgr' | 'other';
  evidence: string;
}

/** Common third-party patterns — consumer list, not a blocklist. */
export const TRACKER_PATTERNS: {
  id: string;
  label: string;
  category: TrackerHit['category'];
  re: RegExp;
}[] = [
  { id: 'ga', label: 'Google Analytics', category: 'analytics', re: /google-analytics\.com|googletagmanager\.com\/gtag|gtag\s*\(/i },
  { id: 'gtm', label: 'Google Tag Manager', category: 'tagmgr', re: /googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/i },
  { id: 'fb', label: 'Meta Pixel', category: 'ads', re: /connect\.facebook\.net|fbq\s*\(/i },
  { id: 'tt', label: 'TikTok Pixel', category: 'ads', re: /analytics\.tiktok\.com|ttq\.load/i },
  { id: 'tw', label: 'X / Twitter pixel', category: 'ads', re: /static\.ads-twitter\.com|twq\s*\(/i },
  { id: 'li', label: 'LinkedIn Insight', category: 'ads', re: /snap\.licdn\.com|linkedin\.com\/px/i },
  { id: 'pinterest', label: 'Pinterest Tag', category: 'ads', re: /s\.pinimg\.com\/ct\/|pintrk\s*\(/i },
  { id: 'snap', label: 'Snap Pixel', category: 'ads', re: /sc-static\.net\/scevent|snaptr\s*\(/i },
  { id: 'reddit', label: 'Reddit Pixel', category: 'ads', re: /alb\.reddit\.com|rdt\s*\(/i },
  { id: 'bing', label: 'Microsoft Ads (UET)', category: 'ads', re: /bat\.bing\.com|uetq/i },
  { id: 'criteo', label: 'Criteo', category: 'ads', re: /static\.criteo\.net|criteo\.com/i },
  { id: 'taboola', label: 'Taboola', category: 'ads', re: /cdn\.taboola\.com/i },
  { id: 'outbrain', label: 'Outbrain', category: 'ads', re: /widgets\.outbrain\.com/i },
  { id: 'hotjar', label: 'Hotjar', category: 'analytics', re: /static\.hotjar\.com|hotjar/i },
  { id: 'mixpanel', label: 'Mixpanel', category: 'analytics', re: /cdn\.mxpnl\.com|mixpanel/i },
  { id: 'segment', label: 'Segment', category: 'analytics', re: /cdn\.segment\.com|analytics\.load/i },
  { id: 'amplitude', label: 'Amplitude', category: 'analytics', re: /cdn\.amplitude\.com|amplitude/i },
  { id: 'fullstory', label: 'FullStory', category: 'analytics', re: /fullstory\.com|FS\.identify/i },
  { id: 'heap', label: 'Heap', category: 'analytics', re: /cdn\.heapanalytics\.com|heap\./i },
  { id: 'clarity', label: 'Microsoft Clarity', category: 'analytics', re: /clarity\.ms/i },
  { id: 'plausible', label: 'Plausible', category: 'analytics', re: /plausible\.io\/js/i },
  { id: 'matomo', label: 'Matomo', category: 'analytics', re: /matomo\.js|piwik\.js/i },
  { id: 'newrelic', label: 'New Relic', category: 'analytics', re: /js-agent\.newrelic\.com|nr-data\.net/i },
  { id: 'sentry', label: 'Sentry', category: 'analytics', re: /browser\.sentry-cdn\.com|sentry\.io/i },
  { id: 'intercom', label: 'Intercom', category: 'social', re: /widget\.intercom\.io|intercomcdn/i },
  { id: 'hubspot', label: 'HubSpot tracking', category: 'analytics', re: /js\.hs-scripts\.com|hs-analytics/i },
  { id: 'cookiebot', label: 'Cookiebot', category: 'other', re: /consent\.cookiebot\.com/i },
  { id: 'onetrust', label: 'OneTrust', category: 'other', re: /cdn\.cookielaw\.org|onetrust/i },
  { id: 'quantcast', label: 'Quantcast', category: 'ads', re: /quantcast\.com|quantserve/i },
  { id: 'doubleclick', label: 'Google DoubleClick', category: 'ads', re: /doubleclick\.net|googlesyndication\.com/i },
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

/** 0–100: higher = fewer known trackers on page. */
export function privacyScore(hitCount: number): number {
  if (hitCount <= 0) return 100;
  return Math.max(0, 100 - hitCount * 8);
}

/** Page-world scanner for executeScript — patterns inlined (no imports). */
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
    { id: 'pinterest', label: 'Pinterest Tag', category: 'ads', re: /s\.pinimg\.com\/ct\/|pintrk\s*\(/i },
    { id: 'snap', label: 'Snap Pixel', category: 'ads', re: /sc-static\.net\/scevent|snaptr\s*\(/i },
    { id: 'reddit', label: 'Reddit Pixel', category: 'ads', re: /alb\.reddit\.com|rdt\s*\(/i },
    { id: 'bing', label: 'Microsoft Ads (UET)', category: 'ads', re: /bat\.bing\.com|uetq/i },
    { id: 'criteo', label: 'Criteo', category: 'ads', re: /static\.criteo\.net|criteo\.com/i },
    { id: 'taboola', label: 'Taboola', category: 'ads', re: /cdn\.taboola\.com/i },
    { id: 'outbrain', label: 'Outbrain', category: 'ads', re: /widgets\.outbrain\.com/i },
    { id: 'hotjar', label: 'Hotjar', category: 'analytics', re: /static\.hotjar\.com|hotjar/i },
    { id: 'mixpanel', label: 'Mixpanel', category: 'analytics', re: /cdn\.mxpnl\.com|mixpanel/i },
    { id: 'segment', label: 'Segment', category: 'analytics', re: /cdn\.segment\.com|analytics\.load/i },
    { id: 'amplitude', label: 'Amplitude', category: 'analytics', re: /cdn\.amplitude\.com|amplitude/i },
    { id: 'fullstory', label: 'FullStory', category: 'analytics', re: /fullstory\.com|FS\.identify/i },
    { id: 'heap', label: 'Heap', category: 'analytics', re: /cdn\.heapanalytics\.com|heap\./i },
    { id: 'clarity', label: 'Microsoft Clarity', category: 'analytics', re: /clarity\.ms/i },
    { id: 'plausible', label: 'Plausible', category: 'analytics', re: /plausible\.io\/js/i },
    { id: 'matomo', label: 'Matomo', category: 'analytics', re: /matomo\.js|piwik\.js/i },
    { id: 'newrelic', label: 'New Relic', category: 'analytics', re: /js-agent\.newrelic\.com|nr-data\.net/i },
    { id: 'sentry', label: 'Sentry', category: 'analytics', re: /browser\.sentry-cdn\.com|sentry\.io/i },
    { id: 'intercom', label: 'Intercom', category: 'social', re: /widget\.intercom\.io|intercomcdn/i },
    { id: 'hubspot', label: 'HubSpot tracking', category: 'analytics', re: /js\.hs-scripts\.com|hs-analytics/i },
    { id: 'cookiebot', label: 'Cookiebot', category: 'other', re: /consent\.cookiebot\.com/i },
    { id: 'onetrust', label: 'OneTrust', category: 'other', re: /cdn\.cookielaw\.org|onetrust/i },
    { id: 'quantcast', label: 'Quantcast', category: 'ads', re: /quantcast\.com|quantserve/i },
    { id: 'doubleclick', label: 'Google DoubleClick', category: 'ads', re: /doubleclick\.net|googlesyndication\.com/i },
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
