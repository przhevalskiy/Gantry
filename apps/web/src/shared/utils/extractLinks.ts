export interface ExtractedLink {
  url: string;
  display: string;
  label: string;
}

const URL_REGEX = /https?:\/\/[^\s)<>\]"'`,;]+/gi;
const DOI_REGEX = /\bdoi\.org\/[^\s)<>\]"'`,;]+/gi;

function cleanUrl(url: string): string {
  return url.replace(/[.),:;!?]+$/, '');
}

function makeDisplay(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname === '/' ? '' : u.pathname;
    const display = host + path;
    return display.length > 60 ? display.slice(0, 57) + '...' : display;
  } catch {
    return url.length > 60 ? url.slice(0, 57) + '...' : url;
  }
}

/**
 * Extract a contextual label from the text surrounding a URL.
 * Grabs up to 80 chars before the URL on the same line, trimmed to the
 * nearest word boundary, stripping leading punctuation/whitespace.
 */
function extractLabel(text: string, urlIndex: number): string {
  // Find the start of the line containing this URL
  const lineStart = text.lastIndexOf('\n', urlIndex - 1) + 1;
  const before = text.slice(lineStart, urlIndex).trim();

  if (before.length > 0) {
    // Clean leading bullets, numbers, dashes
    let label = before.replace(/^[-–—•*+\d.)\]]+\s*/, '').trim();
    // Remove trailing colons, dashes, parens
    label = label.replace(/[:(\-–—]+$/, '').trim();
    if (label.length > 80) {
      label = label.slice(0, 77).replace(/\s\S*$/, '') + '...';
    }
    if (label.length > 3) return label;
  }

  return '';
}

export function extractLinks(text: string): ExtractedLink[] {
  if (!text) return [];

  const seen = new Set<string>();
  const links: ExtractedLink[] = [];

  // Use exec loop to get match indices
  URL_REGEX.lastIndex = 0;
  let match;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const url = cleanUrl(match[0]);
    if (!seen.has(url)) {
      seen.add(url);
      const label = extractLabel(text, match.index);
      links.push({ url, display: makeDisplay(url), label });
    }
  }

  DOI_REGEX.lastIndex = 0;
  while ((match = DOI_REGEX.exec(text)) !== null) {
    const cleaned = cleanUrl(match[0]);
    const url = `https://${cleaned}`;
    if (!seen.has(url)) {
      seen.add(url);
      const label = extractLabel(text, match.index);
      links.push({ url, display: cleaned, label });
    }
  }

  return links;
}
