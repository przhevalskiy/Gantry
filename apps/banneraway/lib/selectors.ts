/** Common CMP / cookie banner hooks — hide via CSS. */
export const HIDE_SELECTORS = [
  '#onetrust-banner-sdk',
  '#onetrust-consent-sdk',
  '.onetrust-pc-dark-filter',
  '#CybotCookiebotDialog',
  '#CybotCookiebotDialogBodyUnderlay',
  '.cc-window',
  '.cc-banner',
  '#cookie-law-info-bar',
  '.cli-modal-backdrop',
  '#cookiebanner',
  '.cookiebanner',
  '#cookie-banner',
  '.cookie-banner',
  '#cookieConsent',
  '.cookie-consent',
  '#gdpr-banner',
  '.gdpr-banner',
  '[id*="cookie-consent" i]',
  '[class*="cookie-consent" i]',
  '[id*="cookieBanner" i]',
  '[class*="cookieBanner" i]',
  '[data-testid*="cookie-banner" i]',
  'div[aria-label*="cookie" i][role="dialog"]',
  'div[aria-label*="consent" i][role="dialog"]',
  '#sp_message_container_1',
  '.message-container',
  '.fc-consent-root',
  '.qc-cmp2-container',
  '#didomi-popup',
  '.didomi-popup-container',
  '#sp-cookie-banner',
  'aside#cookie-notice',
];

export const REJECT_BUTTON_RE =
  /^(reject all|reject|decline|deny|refuse|only necessary|essential only|必要(?:なもの)?のみ|ablehnen|alles ablehnen|refuser|tout refuser)$/i;

export function buildHideCss(selectors: string[] = HIDE_SELECTORS): string {
  return `${selectors.join(',\n')} {\n  display: none !important;\n  visibility: hidden !important;\n  pointer-events: none !important;\n}\nhtml, body {\n  overflow: auto !important;\n}`;
}

export function isRejectLabel(text: string): boolean {
  return REJECT_BUTTON_RE.test(text.trim());
}
