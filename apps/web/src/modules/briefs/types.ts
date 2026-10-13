/** Org or system playbook as a Brief (job packet). */
export type Brief = {
  id: string;
  slug?: string;
  name?: string;
  description?: string;
  pack?: string;
  raw: Record<string, unknown>;
};
