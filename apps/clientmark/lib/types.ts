export type MarkColor = 'coral' | 'amber' | 'lime' | 'sky' | 'violet' | 'slate';

export interface ClientMark {
  id: string;
  /** Match against tab URL (substring) */
  urlMatch: string;
  label: string;
  color: MarkColor;
  createdAt: number;
}

export interface ClientMarkState {
  version: 1;
  marks: ClientMark[];
  settings: {
    renameTabs: boolean;
    showBadge: boolean;
    pro: { enabled: boolean };
  };
}

export const STORAGE_KEY = 'clientmark_state_v1' as const;

export const COLORS: Record<MarkColor, { bg: string; hex: string; label: string }> = {
  coral: { bg: '#ff6b4a', hex: '#ff6b4a', label: 'Coral' },
  amber: { bg: '#f5a524', hex: '#f5a524', label: 'Amber' },
  lime: { bg: '#9fd40f', hex: '#9fd40f', label: 'Lime' },
  sky: { bg: '#3aa0ff', hex: '#3aa0ff', label: 'Sky' },
  violet: { bg: '#8b6bff', hex: '#8b6bff', label: 'Violet' },
  slate: { bg: '#64748b', hex: '#64748b', label: 'Slate' },
};
