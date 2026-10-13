/** Presence field on an Operator seat — maps SSE/lifecycle → portrait chrome. */
export type OperatorPresence = 'idle' | 'active' | 'blocked' | 'done' | 'ghost';

/** One Temporal seat as shown on the floor or People handbook. */
export type OperatorSeat = {
  /** Stable role key from catalog / stage graph (e.g. foreman, pm, builder). */
  roleId: string;
  /** Display title — always shown near portrait in roster. */
  title: string;
  /** Catalog description (People directory). */
  description?: string;
  presence: OperatorPresence;
  /** Optional live snippet (“Inspector · heal 1/2”). */
  snippet?: string;
  /** Parallel builder tracks without cloning faces. */
  parallelCount?: number;
  /** Pack specialist (e.g. oracle-a11y) — same bezel system. */
  packRole?: boolean;
};

/** Default L5 staffing order for EngagementFloor. */
export const DEFAULT_FLOOR_ORDER = [
  'foreman',
  'pm',
  'architect',
  'builder',
  'inspector',
  'reviewer',
  'security',
  'devops',
] as const;

export type FloorRoleId = (typeof DEFAULT_FLOOR_ORDER)[number] | (string & {});
