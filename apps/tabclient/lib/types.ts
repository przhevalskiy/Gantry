export type MarkColor = 'coral' | 'amber' | 'lime' | 'sky' | 'violet' | 'slate';

export interface ClientMark {
  id: string;
  urlMatch: string;
  label: string;
  color: MarkColor;
  createdAt: number;
}

export interface MarkState {
  version: 1;
  marks: ClientMark[];
  settings: {
    renameTabs: boolean;
    pro: { enabled: boolean };
  };
}

export const STORAGE_KEY = 'tabclient_state_v1' as const;

export const COLORS: Record<MarkColor, { hex: string; label: string }> = {
  coral: { hex: '#ff6b4a', label: 'Coral' },
  amber: { hex: '#f5a524', label: 'Amber' },
  lime: { hex: '#9fd40f', label: 'Lime' },
  sky: { hex: '#3aa0ff', label: 'Sky' },
  violet: { hex: '#8b6bff', label: 'Violet' },
  slate: { hex: '#64748b', label: 'Slate' },
};

/** Review-safe allowlist — never expand to <all_urls>. */
export const ALLOWLIST_NOTE = 'Named SaaS admin hosts only';

