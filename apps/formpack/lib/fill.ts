/** Page-world autofill — no imports (executeScript-safe). */
export function fillFormFields(fields: { key: string; value: string }[]): {
  filled: number;
  matched: string[];
} {
  const matched: string[] = [];
  let filled = 0;

  const controls = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea, select',
    ),
  );

  for (const field of fields) {
    const hints = field.key
      .toLowerCase()
      .split('/')
      .map((h) => h.trim())
      .filter(Boolean);
    const el = controls.find((c) => {
      const hay = [
        c.name,
        c.id,
        c.getAttribute('placeholder') || '',
        c.getAttribute('aria-label') || '',
        c.getAttribute('autocomplete') || '',
        (c.labels && c.labels[0]?.textContent) || '',
      ]
        .join(' ')
        .toLowerCase();
      return hints.some((h) => hay.includes(h));
    });
    if (!el) continue;
    if (el instanceof HTMLSelectElement) {
      const opt = Array.from(el.options).find(
        (o) =>
          o.value.toLowerCase() === field.value.toLowerCase() ||
          o.text.toLowerCase() === field.value.toLowerCase(),
      );
      if (opt) {
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled += 1;
        matched.push(field.key);
      }
      continue;
    }
    el.focus();
    el.value = field.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    filled += 1;
    matched.push(field.key);
  }

  return { filled, matched };
}
