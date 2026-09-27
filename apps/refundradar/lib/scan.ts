/** Page-world scanner — no imports (passed to chrome.scripting.executeScript). */
export function scanRefundPage(threshold: number): {
  storeLabel: string;
  url: string;
  signals: {
    id: string;
    label: string;
    severity: 'ok' | 'watch' | 'spike' | 'info';
    detail: string;
    count?: number;
  }[];
} {
  const url = location.href;
  const host = location.hostname;
  const isAdmin = host.includes('admin.shopify.com') || host.includes('myshopify.com');
  const title = document.title.split(/ [|] /)[0]?.trim() || host;
  const text = (document.body?.innerText || '').slice(0, 80000);
  const html = document.documentElement.innerHTML.slice(0, 200000);

  const signals: {
    id: string;
    label: string;
    severity: 'ok' | 'watch' | 'spike' | 'info';
    detail: string;
    count?: number;
  }[] = [];

  const push = (
    id: string,
    label: string,
    severity: 'ok' | 'watch' | 'spike' | 'info',
    detail: string,
    count?: number,
  ) => {
    signals.push({ id, label, severity, detail, count });
  };

  if (!isAdmin) {
    push('host', 'Shopify admin', 'info', 'Open a Shopify admin tab for refund/return signals.');
    return { storeLabel: title, url, signals };
  }
  push('host', 'Shopify admin', 'ok', 'Shopify admin host detected.');

  const countMatches = (re: RegExp) => (text.match(re) || []).length;

  const refundMentions = countMatches(/\brefund(s|ed|ing)?\b/gi);
  const returnMentions = countMatches(/\breturn(s|ed|ing)?\b/gi);
  const cancelMentions = countMatches(/\bcancel(s|led|lation)?\b/gi);

  const severityFor = (n: number): 'ok' | 'watch' | 'spike' => {
    if (n >= threshold) return 'spike';
    if (n >= Math.max(2, Math.floor(threshold / 2))) return 'watch';
    return 'ok';
  };

  push(
    'refunds',
    'Refund mentions',
    severityFor(refundMentions),
    refundMentions
      ? `${refundMentions} refund-related terms on this view (threshold ${threshold}).`
      : 'No refund terms visible on this view.',
    refundMentions,
  );

  push(
    'returns',
    'Return mentions',
    severityFor(returnMentions),
    returnMentions
      ? `${returnMentions} return-related terms on this view (threshold ${threshold}).`
      : 'No return terms visible on this view.',
    returnMentions,
  );

  push(
    'cancels',
    'Cancel mentions',
    severityFor(cancelMentions),
    cancelMentions
      ? `${cancelMentions} cancel-related terms on this view.`
      : 'No cancel terms visible on this view.',
    cancelMentions,
  );

  const onOrders =
    /\/orders/i.test(url) || /orders/i.test(document.title) || !!document.querySelector('[data-orders], a[href*="/orders"]');
  push(
    'context',
    'Orders context',
    onOrders ? 'ok' : 'info',
    onOrders
      ? 'Looks like an orders-related admin view.'
      : 'Tip: open Orders / refunds for stronger signals.',
  );

  const moneyHits = (text.match(/\$[\d,]+\.\d{2}/g) || []).length;
  if (moneyHits > 0) {
    push('money', 'Money amounts visible', 'info', `${moneyHits} currency amounts on this view.`);
  }

  const reasonHints = ['defective', 'wrong item', 'not as described', 'damaged', 'changed mind'];
  const foundReasons = reasonHints.filter((r) => text.toLowerCase().includes(r));
  if (foundReasons.length) {
    push(
      'reasons',
      'Return reason cues',
      'watch',
      `Seen: ${foundReasons.join(', ')}.`,
    );
  } else {
    push('reasons', 'Return reason cues', 'info', 'No common return-reason phrases visible.');
  }

  const tableRows = document.querySelectorAll('table tbody tr, [role="row"]').length;
  if (tableRows > 0) {
    push('rows', 'List density', tableRows >= threshold ? 'watch' : 'ok', `${tableRows} table/list rows visible.`, tableRows);
  }

  // Quiet unused html lint
  void html;

  return { storeLabel: title, url, signals };
}

export function spikeScore(
  signals: { severity: 'ok' | 'watch' | 'spike' | 'info' }[],
): number {
  if (!signals.length) return 0;
  const weight = { ok: 10, info: 20, watch: 55, spike: 100 } as const;
  const total = signals.reduce((sum, s) => sum + weight[s.severity], 0);
  return Math.round(total / signals.length);
}
