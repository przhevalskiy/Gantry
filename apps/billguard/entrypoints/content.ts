import { COLORS } from '@/lib/types';
import { findClientForUrl, isBillingUrl, loadState } from '@/lib/storage';

const BAR_ID = 'billguard-bar';
const MODAL_ID = 'billguard-modal';
const ACK_KEY = 'billguard_ack';

function sessionAcked(clientId: string, url: string): boolean {
  try {
    return sessionStorage.getItem(`${ACK_KEY}:${clientId}:${url.split('?')[0]}`) === '1';
  } catch {
    return false;
  }
}

function setAck(clientId: string, url: string) {
  try {
    sessionStorage.setItem(`${ACK_KEY}:${clientId}:${url.split('?')[0]}`, '1');
  } catch {
    /* ignore */
  }
}

function removeModal() {
  document.getElementById(MODAL_ID)?.remove();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showModal(label: string, color: string, clientId: string, requireTyped: boolean) {
  if (document.getElementById(MODAL_ID)) return;
  const safeLabel = escapeHtml(label);
  const wrap = document.createElement('div');
  wrap.id = MODAL_ID;
  Object.assign(wrap.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    background: 'rgba(10,16,28,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, sans-serif',
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    width: 'min(420px, 92vw)',
    background: '#fff',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
    borderTop: `4px solid ${color}`,
  });

  card.innerHTML = `
    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b">BillGuard</p>
    <p style="margin:8px 0 0;font-size:18px;font-weight:800;color:#0f172a">Confirm billing client</p>
    <p style="margin:8px 0 0;font-size:14px;color:#334155;line-height:1.45">
      This looks like a <strong>billing / payment</strong> page for
      <strong style="color:${color}">${safeLabel}</strong>. Continue only if that is correct.
    </p>
    ${
      requireTyped
        ? `<input id="billguard-type" placeholder="Type client name to confirm" style="margin-top:14px;width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid #cbd5e1;font-size:13px" />`
        : ''
    }
    <div style="display:flex;gap:8px;margin-top:16px">
      <button id="billguard-cancel" type="button" style="flex:1;padding:10px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font-weight:600;cursor:pointer">Go back</button>
      <button id="billguard-ok" type="button" style="flex:1;padding:10px;border-radius:10px;border:none;background:${color};color:#111;font-weight:700;cursor:pointer">Yes, continue</button>
    </div>
  `;
  wrap.appendChild(card);
  document.documentElement.appendChild(wrap);

  card.querySelector('#billguard-cancel')?.addEventListener('click', () => {
    history.back();
    removeModal();
  });
  card.querySelector('#billguard-ok')?.addEventListener('click', () => {
    if (requireTyped) {
      const input = card.querySelector('#billguard-type') as HTMLInputElement | null;
      if (!input || input.value.trim().toLowerCase() !== label.trim().toLowerCase()) {
        input?.focus();
        input && (input.style.borderColor = '#ef4444');
        return;
      }
    }
    setAck(clientId, location.href);
    removeModal();
  });
}

async function paint() {
  const state = await loadState();
  const existingBar = document.getElementById(BAR_ID);
  if (!state.settings.enabled) {
    existingBar?.remove();
    removeModal();
    return;
  }

  const client = findClientForUrl(state.clients, location.href);
  if (!client) {
    existingBar?.remove();
    removeModal();
    return;
  }

  const color = COLORS[client.color].hex;
  let bar = existingBar;
  if (!bar) {
    bar = document.createElement('div');
    bar.id = BAR_ID;
    Object.assign(bar.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      height: '4px',
      zIndex: '2147483646',
      pointerEvents: 'none',
    });
    document.documentElement.appendChild(bar);
  }
  bar.style.background = color;
  bar.title = `BillGuard: ${client.label}`;

  if (isBillingUrl(location.href) && !sessionAcked(client.id, location.href)) {
    showModal(client.label, color, client.id, state.settings.requireTypedConfirm);
  } else {
    removeModal();
  }
}

export default defineContentScript({
  matches: [
    'https://ads.google.com/*',
    'https://business.facebook.com/*',
    'https://adsmanager.facebook.com/*',
    'https://www.facebook.com/adsmanager/*',
  ],
  runAt: 'document_idle',
  main() {
    void paint();
    browser.storage.onChanged.addListener(() => void paint());
    let last = location.href;
    setInterval(() => {
      if (location.href !== last) {
        last = location.href;
        void paint();
      }
    }, 1000);
  },
});
