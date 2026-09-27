/** Page-world capture — no imports (passed to chrome.scripting.executeScript). */
export function captureProductFields(): {
  productLabel: string;
  url: string;
  fields: { key: string; label: string; value: string }[];
} {
  const url = location.href;
  const title = document.title.split(/ [|] /)[0]?.trim() || 'Product';
  const fields: { key: string; label: string; value: string }[] = [];
  const seen = new Set<string>();

  const push = (key: string, label: string, value: string) => {
    const v = value.replace(/\s+/g, ' ').trim();
    if (!v || seen.has(key)) return;
    seen.add(key);
    fields.push({ key, label, value: v.slice(0, 500) });
  };

  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select',
    ),
  ).slice(0, 80);

  for (const el of inputs) {
    const name = el.getAttribute('name') || el.id || el.getAttribute('aria-label') || '';
    const labelEl = el.id
      ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      : el.closest('label');
    const labelText =
      (labelEl?.textContent || '').replace(/\s+/g, ' ').trim() ||
      el.getAttribute('aria-label') ||
      name ||
      el.placeholder ||
      'Field';
    const key = (name || labelText).toLowerCase().slice(0, 80);
    const value = 'value' in el ? String(el.value ?? '') : '';
    // Prefer product-ish fields
    if (
      /title|name|price|sku|barcode|inventory|quantity|variant|option|compare|weight|vendor|type|description|handle/i.test(
        key + ' ' + labelText,
      )
    ) {
      push(key, labelText.slice(0, 60), value);
    }
  }

  // Contenteditable / rich text snippets
  const rich = Array.from(document.querySelectorAll<HTMLElement>('[contenteditable="true"]')).slice(0, 5);
  rich.forEach((el, i) => {
    push(`rich_${i}`, `Rich text ${i + 1}`, el.innerText || '');
  });

  if (!fields.length) {
    push('page_title', 'Page title', title);
    push('url', 'URL', url);
  }

  return { productLabel: title, url, fields };
}

export function diffFields(
  before: { key: string; label: string; value: string }[],
  after: { key: string; label: string; value: string }[],
): { key: string; label: string; before: string; after: string; changed: boolean }[] {
  const afterMap = new Map(after.map((f) => [f.key, f]));
  const beforeMap = new Map(before.map((f) => [f.key, f]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const diffs: { key: string; label: string; before: string; after: string; changed: boolean }[] = [];
  for (const key of keys) {
    const b = beforeMap.get(key);
    const a = afterMap.get(key);
    const beforeVal = b?.value ?? '';
    const afterVal = a?.value ?? '';
    diffs.push({
      key,
      label: a?.label || b?.label || key,
      before: beforeVal,
      after: afterVal,
      changed: beforeVal !== afterVal,
    });
  }
  return diffs.sort((x, y) => Number(y.changed) - Number(x.changed) || x.label.localeCompare(y.label));
}
