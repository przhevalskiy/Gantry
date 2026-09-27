/** Insert text into the currently focused editable element. */
export function insertTextAtCaret(text: string): { ok: boolean; reason?: string } {
  const el = document.activeElement;
  if (!el) {
    return { ok: false, reason: 'No focused field' };
  }

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    if (el instanceof HTMLInputElement && !isTextualInput(el)) {
      return { ok: false, reason: 'Focus a text field first' };
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const value = el.value;
    el.value = value.slice(0, start) + text + value.slice(end);
    const caret = start + text.length;
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true };
  }

  if (isContentEditable(el)) {
    const selection = window.getSelection();
    if (!selection) {
      return { ok: false, reason: 'No selection' };
    }
    if (selection.rangeCount === 0) {
      el.focus();
    }
    const range =
      selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange();
    if (selection.rangeCount === 0) {
      range.selectNodeContents(el);
      range.collapse(false);
      selection.addRange(range);
    }
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

/** Replace a trailing shortcut token with snippet body. */
export function expandShortcutInField(
  shortcut: string,
  body: string,
): boolean {
  const el = document.activeElement;
  if (!el) return false;

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    if (el instanceof HTMLInputElement && !isTextualInput(el)) return false;
    const caret = el.selectionStart ?? 0;
    const before = el.value.slice(0, caret);
    if (!before.toLowerCase().endsWith(shortcut.toLowerCase())) return false;
    const start = caret - shortcut.length;
    el.value = el.value.slice(0, start) + body + el.value.slice(caret);
    const next = start + body.length;
    el.setSelectionRange(next, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  if (isContentEditable(el)) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      return false;
    }
    const range = selection.getRangeAt(0);
    const probe = range.cloneRange();
    probe.setStart(range.startContainer, Math.max(0, range.startOffset - shortcut.length));
    const token = probe.toString();
    if (token.toLowerCase() !== shortcut.toLowerCase()) return false;
    probe.deleteContents();
    const node = document.createTextNode(body);
    probe.insertNode(node);
    probe.setStartAfter(node);
    probe.collapse(true);
    selection.removeAllRanges();
    selection.addRange(probe);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  return false;
}

function isTextualInput(el: HTMLInputElement): boolean {
  const type = (el.type || 'text').toLowerCase();
  return ['text', 'search', 'email', 'url', 'tel', ''].includes(type);
}

function isContentEditable(el: Element): el is HTMLElement {
  return el instanceof HTMLElement && el.isContentEditable;
}
