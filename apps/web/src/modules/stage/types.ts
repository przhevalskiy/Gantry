export type StageMode = 'files' | 'diff' | 'preview' | 'hidden';

export type StageFileRef = {
  path: string;
  workspaceId: string;
  source?: string;
};
