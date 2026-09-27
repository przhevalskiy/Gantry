export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface EvidenceItem {
  id: string;
  title: string;
  url: string;
  pageTitle: string;
  note: string;
  /** data URL (png) */
  screenshotDataUrl: string;
  checklist: ChecklistItem[];
  capturedAt: number;
}

export interface EvidenceKitState {
  version: 1;
  items: EvidenceItem[];
  templates: { id: string; name: string; labels: string[] }[];
  settings: { pro: { enabled: boolean } };
}

export const STORAGE_KEY = 'evidencekit_state_v1' as const;

export const DEFAULT_TEMPLATES = [
  {
    id: 'a11y',
    name: 'Accessibility spot-check',
    labels: ['Keyboard reachable', 'Alt text present', 'Contrast looks OK', 'Focus visible'],
  },
  {
    id: 'privacy',
    name: 'Privacy page review',
    labels: ['Privacy policy linked', 'Cookie notice present', 'Contact/DPO listed', 'Last updated shown'],
  },
  {
    id: 'launch',
    name: 'Launch evidence',
    labels: ['Correct environment URL', 'Feature flag on', 'No console errors visible', 'Stakeholder notified'],
  },
];
