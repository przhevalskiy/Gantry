export type DeliverableKind = 'pr' | 'branch' | 'patch' | 'report' | 'file' | 'unknown';

export type Deliverable = {
  kind: DeliverableKind;
  taskId?: string;
  title: string;
  url?: string | null;
  branch?: string | null;
  artifactId?: string;
  contentType?: string;
  previewText?: string | null;
};
