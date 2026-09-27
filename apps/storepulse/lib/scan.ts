/** Page-world scanner — no imports (passed to chrome.scripting.executeScript). */
export function scanShopifyPage(): {
  storeLabel: string;
  url: string;
  checks: {
    id: string;
    label: string;
    severity: 'pass' | 'warn' | 'fail' | 'info';
    detail: string;
  }[];
} {
  const url = location.href;
  const host = location.hostname;
  const isAdmin = host.includes('admin.shopify.com') || host.includes('myshopify.com');
  const title = document.title.split(/ [|] /)[0]?.trim() || host;

  const checks: {
    id: string;
    label: string;
    severity: 'pass' | 'warn' | 'fail' | 'info';
    detail: string;
  }[] = [];

  const push = (
    id: string,
    label: string,
    severity: 'pass' | 'warn' | 'fail' | 'info',
    detail: string,
  ) => {
    checks.push({ id, label, severity, detail });
  };

  const hasShopifySignals = !!(
    document.querySelector(
      'meta[name="shopify-digital-wallet"], script[src*="cdn.shopify.com"], link[href*="cdn.shopify.com"]',
    ) || isAdmin
  );
  if (!hasShopifySignals) {
    push('platform', 'Shopify signals', 'warn', 'Page does not look like a Shopify storefront or admin.');
  } else {
    push('platform', 'Shopify signals', 'pass', 'Shopify assets or admin host detected.');
  }

  const images = Array.from(document.images);
  const broken = images.filter((img) => !img.complete || img.naturalWidth === 0);
  if (images.length === 0) {
    push('images', 'Images', 'info', 'No <img> elements found on this view.');
  } else if (broken.length > 0) {
    push('images', 'Broken images', 'fail', `${broken.length} of ${images.length} images failed to load.`);
  } else {
    push('images', 'Images', 'pass', `${images.length} images loaded.`);
  }

  const html = document.documentElement.innerHTML;
  const pixels = [
    { name: 'Meta Pixel', present: /fbq\s*\(|connect\.facebook\.net/i.test(html) },
    { name: 'Google tag', present: /gtag\s*\(|googletagmanager\.com/i.test(html) },
    { name: 'TikTok Pixel', present: /ttq\.load|analytics\.tiktok\.com/i.test(html) },
    { name: 'Shopify analytics', present: /shopify.*analytics|trekkie/i.test(html) },
  ];
  const missingPixels = pixels.filter((p) => !p.present).map((p) => p.name);
  const presentPixels = pixels.filter((p) => p.present).map((p) => p.name);
  if (presentPixels.length === 0) {
    push('pixels', 'Tracking pixels', 'warn', 'No common ad pixels detected on this page.');
  } else {
    push(
      'pixels',
      'Tracking pixels',
      missingPixels.length ? 'warn' : 'pass',
      `Found: ${presentPixels.join(', ')}${missingPixels.length ? `. Missing: ${missingPixels.join(', ')}` : ''}`,
    );
  }

  const policyHints = ['privacy', 'refund', 'shipping', 'terms'];
  const links = Array.from(document.querySelectorAll('a[href]')).map((a) =>
    ((a as HTMLAnchorElement).href + ' ' + (a.textContent || '')).toLowerCase(),
  );
  const foundPolicies = policyHints.filter((p) => links.some((l) => l.includes(p)));
  if (foundPolicies.length >= 3) {
    push('policies', 'Policy pages', 'pass', `Linked: ${foundPolicies.join(', ')}.`);
  } else if (isAdmin) {
    push('policies', 'Policy pages', 'info', 'Open the live storefront to audit policy links.');
  } else {
    push('policies', 'Policy pages', 'warn', `Only found: ${foundPolicies.join(', ') || 'none'}.`);
  }

  const unpublished =
    /unpublished|draft product|not published/i.test(document.body.innerText) ||
    !!document.querySelector('[data-status="draft"], .status-draft');
  push(
    'publish',
    'Publish status cues',
    unpublished ? 'warn' : 'info',
    unpublished
      ? 'Draft/unpublished cues visible on this page.'
      : 'No draft/unpublished cues in visible text.',
  );

  const altMissing = images.filter((img) => !img.alt || !img.alt.trim()).length;
  if (images.length && altMissing > 0) {
    push('a11y', 'Image alt text', 'warn', `${altMissing} images missing alt text.`);
  } else if (images.length) {
    push('a11y', 'Image alt text', 'pass', 'All images have alt text.');
  }

  return { storeLabel: title, url, checks };
}
