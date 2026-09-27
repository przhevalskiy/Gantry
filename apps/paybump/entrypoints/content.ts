import { listMacros, loadState, recordUsage } from '@/lib/storage';

function expandShortcutInField(shortcut: string, body: string): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) {
    if (!(el instanceof HTMLElement) || !el.isContentEditable) return false;
  }

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
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

  return false;
}

async function tryExpand() {
  const settings = (await loadState()).settings;
  if (!settings.expandShortcuts) return;
  const macros = await listMacros();
  const ordered = [...macros]
    .filter((m) => m.shortcut)
    .sort((a, b) => b.shortcut.length - a.shortcut.length);
  for (const m of ordered) {
    if (expandShortcutInField(m.shortcut, m.body)) {
      await recordUsage(m.id);
      break;
    }
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    document.addEventListener(
      'keyup',
      (event) => {
        if (event.key === ' ' || event.key === 'Enter' || event.key === 'Tab') {
          void tryExpand();
        }
      },
      true,
    );
  },
});
