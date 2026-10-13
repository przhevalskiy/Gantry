import type { OperatorSeat } from './types';
import { DEFAULT_FLOOR_ORDER } from './types';

/** Build L5 floor seats; unstaffed seats stay ghost. */
export function buildFloorSeats(opts: {
  catalogRoles?: { roleId: string; title: string; description?: string }[];
  activeRoleId?: string | null;
  blocked?: boolean;
  doneRoleIds?: string[];
  snippet?: string;
}): OperatorSeat[] {
  const byId = new Map(
    (opts.catalogRoles ?? []).map(r => [normalize(r.roleId), r]),
  );

  const order =
    opts.catalogRoles && opts.catalogRoles.length > 0
      ? [
          ...DEFAULT_FLOOR_ORDER.filter(id => byId.has(id) || id === 'foreman'),
          ...opts.catalogRoles
            .map(r => normalize(r.roleId))
            .filter(id => !DEFAULT_FLOOR_ORDER.includes(id as (typeof DEFAULT_FLOOR_ORDER)[number])),
        ]
      : [...DEFAULT_FLOOR_ORDER];

  // Always ensure Foreman first
  if (!order.includes('foreman')) order.unshift('foreman');

  const unique = [...new Set(order)];
  const done = new Set((opts.doneRoleIds ?? []).map(normalize));
  const active = opts.activeRoleId ? normalize(opts.activeRoleId) : null;

  return unique.map(roleId => {
    const cat = byId.get(roleId);
    const title =
      cat?.title ??
      (roleId === 'foreman' ? 'Foreman' : roleId.charAt(0).toUpperCase() + roleId.slice(1));

    let presence: OperatorSeat['presence'] = 'ghost';
    if (done.has(roleId)) presence = 'done';
    else if (opts.blocked && (active === roleId || roleId === 'foreman')) presence = 'blocked';
    else if (active === roleId) presence = 'active';
    else if (cat || roleId === 'foreman') presence = 'idle';

    return {
      roleId,
      title,
      description: cat?.description,
      presence,
      snippet:
        roleId === 'foreman'
          ? opts.snippet
          : active === roleId
            ? opts.snippet
            : undefined,
      packRole: Boolean(cat && !DEFAULT_FLOOR_ORDER.includes(roleId as (typeof DEFAULT_FLOOR_ORDER)[number])),
    };
  });
}

function normalize(id: string): string {
  return id.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
}

/** Infer active role from lifecycle / message text. */
export function inferActiveRole(text: string): string | null {
  const lower = text.toLowerCase();
  const roles = [
    'foreman',
    'pm',
    'architect',
    'builder',
    'inspector',
    'reviewer',
    'security',
    'devops',
    'oracle-a11y',
    'oracle_a11y',
  ];
  for (const r of roles) {
    if (lower.includes(r.replace('-', ' ')) || lower.includes(r) || lower.includes(r.replace('_', '-'))) {
      return r.replace('_', '-');
    }
  }
  return null;
}
