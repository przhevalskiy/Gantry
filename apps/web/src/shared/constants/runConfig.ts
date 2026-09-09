/** UI mirror of server playbooks + tier labels (see project/schema/playbooks.py). */

export const RUN_SIZE_OPTIONS = [
  { value: -1, label: 'Automatic', hint: 'Classify each goal, then pick tracks, checks, and approvals.' },
  { value: 0, label: 'Quick', hint: 'One builder, lint-only oracle, no heal loop — best for tiny fixes.' },
  { value: 1, label: 'Light', hint: 'Plan, build, tests/lint, one auto-fix pass — backlog-friendly.' },
  { value: 2, label: 'Standard', hint: 'Parallel tracks, full QA, review + security, plan approval.' },
  { value: 3, label: 'Full', hint: 'Max parallelism, full crew, deploy sign-off before PR.' },
] as const;

export const PLAYBOOK_OPTIONS = [
  {
    id: '',
    label: 'General',
    hint: 'No playbook preset — tier and pipeline defaults only.',
  },
  {
    id: 'platform-backlog',
    label: 'Backlog drain',
    hint: 'Small scoped changes: light tier, single track, backlog branch prefix.',
  },
  {
    id: 'a11y-remediation',
    label: 'Accessibility',
    hint: 'WCAG-oriented fixes with an extra a11y oracle before the PR.',
  },
  {
    id: 'monorepo-slice',
    label: 'Monorepo slice',
    hint: 'Package-boundary parallel tracks with conflict resolution.',
  },
] as const;

export type PlaybookId = (typeof PLAYBOOK_OPTIONS)[number]['id'];

export function runSizeLabel(tier: number): string {
  return RUN_SIZE_OPTIONS.find(o => o.value === tier)?.label ?? `Tier ${tier}`;
}

export function runSizeHint(tier: number): string | undefined {
  return RUN_SIZE_OPTIONS.find(o => o.value === tier)?.hint;
}

export function playbookLabel(id: string | null | undefined): string {
  if (!id) return 'General';
  return PLAYBOOK_OPTIONS.find(o => o.id === id)?.label ?? id;
}

export function playbookHint(id: string | null | undefined): string | undefined {
  if (!id) return PLAYBOOK_OPTIONS[0].hint;
  return PLAYBOOK_OPTIONS.find(o => o.id === id)?.hint;
}

/** Short bullets shown in UI — maps to engine capabilities. */
export const FACTORY_CAPABILITIES = [
  {
    title: 'Goal → pull request',
    body: 'Each task runs a durable pipeline on your linked GitHub repo and opens a branch + PR.',
  },
  {
    title: 'Oracle-gated quality',
    body: 'Tests, lint, and types (plus playbook checks) run before DevOps pushes — with auto-fix retries.',
  },
  {
    title: 'Parallel, conflict-aware builds',
    body: 'Architect splits work across tracks; overlapping files are resolved before builders start.',
  },
  {
    title: 'Approvals when you need them',
    body: 'Higher tiers pause for plan or deploy approval — respond in the run stream.',
  },
] as const;
