/** Page-world price extractor — no imports (executeScript). */
export function extractPriceFromPage(): {
  title: string;
  url: string;
  price: number | null;
  currency: string;
  raw: string;
} {
  const url = location.href;
  const title = document.title.split(/ [|\-–] /)[0]?.trim() || document.title;
  const bodyText = (document.body?.innerText || '').slice(0, 20000);

  const meta =
    document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') ||
    document.querySelector('meta[itemprop="price"]')?.getAttribute('content') ||
    document.querySelector('[itemprop="price"]')?.getAttribute('content') ||
    document.querySelector('[data-product-price], [data-price]')?.getAttribute('content') ||
    (document.querySelector('[data-product-price], [data-price]') as HTMLElement | null)?.dataset
      ?.productPrice ||
    (document.querySelector('[data-product-price], [data-price]') as HTMLElement | null)?.dataset?.price;

  const candidates: string[] = [];
  if (meta) candidates.push(meta);

  const priceEls = Array.from(
    document.querySelectorAll(
      '[class*="price"], [id*="price"], .a-price, .product-price, [data-testid*="price"], .priceToPay, .a-offscreen',
    ),
  ).slice(0, 24);
  for (const el of priceEls) {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (t && t.length < 40) candidates.push(t);
  }

  const moneyRe =
    /(?:USD|EUR|GBP|CAD|AUD|\$|€|£)\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s?(?:USD|EUR|GBP)/gi;
  const fromText = bodyText.match(moneyRe) || [];
  candidates.push(...fromText.slice(0, 8));

  const parseOne = (raw: string): { price: number; currency: string; raw: string } | null => {
    const cleaned = raw.replace(/,/g, '');
    const num = cleaned.match(/(\d+(?:\.\d{1,2})?)/);
    if (!num) return null;
    const price = Number(num[1]);
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) return null;
    let currency = 'USD';
    if (/€|EUR/i.test(raw)) currency = 'EUR';
    else if (/£|GBP/i.test(raw)) currency = 'GBP';
    else if (/CAD/i.test(raw)) currency = 'CAD';
    else if (/AUD/i.test(raw)) currency = 'AUD';
    return { price, currency, raw: raw.slice(0, 48) };
  };

  for (const c of candidates) {
    const parsed = parseOne(c);
    if (parsed) return { title, url, ...parsed, price: parsed.price };
  }
  return { title, url, price: null, currency: 'USD', raw: '' };
}

export function priceDelta(history: { price: number }[]): number | null {
  if (history.length < 2) return null;
  const last = history[history.length - 1]!.price;
  const prev = history[history.length - 2]!.price;
  return Number((last - prev).toFixed(2));
}

export function priceRange(history: { price: number }[]): { low: number; high: number } | null {
  if (!history.length) return null;
  let low = history[0]!.price;
  let high = history[0]!.price;
  for (const p of history) {
    if (p.price < low) low = p.price;
    if (p.price > high) high = p.price;
  }
  return { low, high };
}

/** Tiny SVG sparkline path for history prices. */
export function sparklinePath(prices: number[], width = 72, height = 22): string {
  if (prices.length < 2) return '';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  return prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((p - min) / span) * (height - 2) - 1;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
