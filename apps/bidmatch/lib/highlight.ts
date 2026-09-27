export interface HighlightRule {
  keyword: string;
  color: string;
  setName: string;
}

/** Self-contained highlighter for content script / executeScript. */
export function applyHighlights(
  rules: HighlightRule[],
  opts: { caseSensitive: boolean; wholeWord: boolean },
): number {
  const STYLE_ID = 'bidmatch-style';
  const MARK_ATTR = 'data-bidmatch';

  document.querySelectorAll(`mark[${MARK_ATTR}]`).forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(el.textContent || ''), el);
    parent.normalize();
  });

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.documentElement.appendChild(style);
  }
  style.textContent = `
    mark[${MARK_ATTR}] {
      padding: 0 2px;
      border-radius: 2px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
  `;

  if (!rules.length) return 0;

  const escaped = rules
    .map((r) => ({
      ...r,
      pattern: r.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    }))
    .filter((r) => r.pattern.length > 0)
    .sort((a, b) => b.pattern.length - a.pattern.length);

  if (!escaped.length) return 0;

  const flags = opts.caseSensitive ? 'g' : 'gi';
  const body = escaped
    .map((r) => (opts.wholeWord ? `\\b(?:${r.pattern})\\b` : r.pattern))
    .join('|');
  const re = new RegExp(`(${body})`, flags);

  const colorFor = (match: string): string => {
    const hit = escaped.find((r) => {
      const test = new RegExp(
        opts.wholeWord ? `^\\b(?:${r.pattern})\\b$` : `^${r.pattern}$`,
        opts.caseSensitive ? '' : 'i',
      );
      return test.test(match);
    });
    return hit?.color ?? '#c8f135';
  };

  let count = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'MARK'].includes(tag)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.closest(`[${MARK_ATTR}]`)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  for (const textNode of nodes) {
    const text = textNode.nodeValue || '';
    re.lastIndex = 0;
    if (!re.test(text)) continue;
    re.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      }
      const mark = document.createElement('mark');
      mark.setAttribute(MARK_ATTR, '1');
      mark.style.background = colorFor(m[0]);
      mark.style.color = '#111';
      mark.title = `BidMatch: ${m[0]}`;
      mark.textContent = m[0];
      frag.appendChild(mark);
      count += 1;
      last = m.index + m[0].length;
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    textNode.parentNode?.replaceChild(frag, textNode);
  }

  return count;
}
