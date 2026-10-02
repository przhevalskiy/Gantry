import type { MediaBoostSettings } from './types';

type BoostNode = {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
};

const boostMap = new WeakMap<HTMLMediaElement, BoostNode>();

function walkShadow(root: Document | ShadowRoot, out: HTMLMediaElement[]) {
  root.querySelectorAll('video,audio').forEach((el) => out.push(el as HTMLMediaElement));
  root.querySelectorAll('*').forEach((el) => {
    const sr = (el as HTMLElement).shadowRoot;
    if (sr) walkShadow(sr, out);
  });
}

export function collectMedia(doc: Document = document): HTMLMediaElement[] {
  const out: HTMLMediaElement[] = [];
  walkShadow(doc, out);
  return out;
}

function ensureBoost(el: HTMLMediaElement, boost: number): void {
  if (boost <= 1) {
    const existing = boostMap.get(el);
    if (existing) {
      existing.gain.gain.value = 1;
    }
    return;
  }
  try {
    let node = boostMap.get(el);
    if (!node) {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      node = { ctx, source, gain };
      boostMap.set(el, node);
    }
    if (node.ctx.state === 'suspended') void node.ctx.resume();
    node.gain.gain.value = boost;
  } catch {
    // CORS / DRM — leave native volume only
  }
}

export function applySettings(settings: MediaBoostSettings, media = collectMedia()): number {
  if (!settings.enabled) return media.length;
  for (const el of media) {
    try {
      el.playbackRate = settings.speed;
      el.volume = settings.volume;
      ensureBoost(el, settings.boost);
    } catch {
      /* ignore per-element failures */
    }
  }
  return media.length;
}

export function wireMedia(el: HTMLMediaElement, getSettings: () => MediaBoostSettings) {
  const reapply = () => applySettings(getSettings(), [el]);
  el.addEventListener('play', reapply);
  el.addEventListener('seeked', reapply);
  el.addEventListener('ratechange', () => {
    const s = getSettings();
    if (s.enabled && Math.abs(el.playbackRate - s.speed) > 0.01) {
      el.playbackRate = s.speed;
    }
  });
}
