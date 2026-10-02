const EXACT = new Set([
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'mc_eid',
  'igshid',
  'igsh',
  'mibextid',
  'twclid',
  'li_fat_id',
  'yclid',
  'vero_conv',
  'vero_id',
  '_hsenc',
  '_hsmi',
  'mc_cid',
  'mc_eid',
  'oly_anon_id',
  'oly_enc_id',
  'rb_clickid',
  's_cid',
  'spm',
  'scm',
  'ref_',
  'ref_src',
  'ref_url',
  'si',
  'feature',
  'pp',
  'ncid',
  'srsltid',
]);

const PREFIXES = ['utm_', 'nr_'];

const AGGRESSIVE = new Set(['ref', 'source', 'campaign', 'aff', 'affiliate', 'fb_action_ids', 'fb_action_types']);

const PROTECT_HOSTS = [/google\./i, /bing\.com$/i, /duckduckgo\.com$/i, /search\.yahoo\./i];

export function isProbablyUrl(text: string): boolean {
  const t = text.trim();
  if (!/^https?:\/\//i.test(t) && !/^www\./i.test(t)) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(t.startsWith('http') ? t : `https://${t}`);
    return true;
  } catch {
    return false;
  }
}

export function cleanUrl(input: string, aggressive = false): { cleaned: string; removed: string[] } {
  const trimmed = input.trim();
  let raw = trimmed;
  if (!/^https?:\/\//i.test(raw) && /^www\./i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { cleaned: trimmed, removed: [] };
  }

  if (PROTECT_HOSTS.some((re) => re.test(url.hostname))) {
    return { cleaned: trimmed, removed: [] };
  }

  const removed: string[] = [];
  const keep = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    const lower = key.toLowerCase();
    const drop =
      EXACT.has(lower) ||
      PREFIXES.some((p) => lower.startsWith(p)) ||
      (aggressive && AGGRESSIVE.has(lower));
    if (drop) removed.push(key);
    else keep.append(key, value);
  });
  url.search = keep.toString();

  // unwrap common redirectors (decode only)
  if (
    (url.hostname.includes('facebook.com') || url.hostname.includes('l.facebook.com')) &&
    url.pathname.includes('/l.php')
  ) {
    const u = url.searchParams.get('u');
    if (u) {
      try {
        return cleanUrl(decodeURIComponent(u), aggressive);
      } catch {
        /* keep */
      }
    }
  }

  let out = url.toString();
  // preserve original scheme-less www copy style
  if (!/^https?:\/\//i.test(trimmed) && /^www\./i.test(trimmed)) {
    out = out.replace(/^https?:\/\//i, '');
  }
  return { cleaned: out, removed };
}
