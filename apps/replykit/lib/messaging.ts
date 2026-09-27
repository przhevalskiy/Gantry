import type { InsertResultMessage } from './types';

/** Insert snippet body into the focused field on the active tab. */
export async function insertIntoActiveTab(body: string): Promise<InsertResultMessage> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { type: 'REPLYKIT_INSERT_RESULT', ok: false, reason: 'No active tab' };
  }

  try {
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: insertInPage,
      args: [body],
    });
    const value = results?.[0]?.result as { ok: boolean; reason?: string } | undefined;
    return {
      type: 'REPLYKIT_INSERT_RESULT',
      ok: Boolean(value?.ok),
      reason: value?.reason,
    };
  } catch {
    return {
      type: 'REPLYKIT_INSERT_RESULT',
      ok: false,
      reason: 'Open a normal webpage and focus a text field',
    };
  }
}

/** Serialized into the page — keep self-contained (no imports). */
function insertInPage(text: string): { ok: boolean; reason?: string } {
  const el = document.activeElement;
  if (!el) return { ok: false, reason: 'No focused field' };

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const type = (el instanceof HTMLInputElement ? el.type : 'text').toLowerCase();
    if (
      el instanceof HTMLInputElement &&
      !['text', 'search', 'email', 'url', 'tel', ''].includes(type)
    ) {
      return { ok: false, reason: 'Focus a text field first' };
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    const caret = start + text.length;
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true };
  }

  if (el instanceof HTMLElement && el.isContentEditable) {
    const selection = window.getSelection();
    if (!selection) return { ok: false, reason: 'No selection' };
    if (selection.rangeCount === 0) {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.addRange(range);
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true };
  }

  return { ok: false, reason: 'Focus a text field first' };
}
