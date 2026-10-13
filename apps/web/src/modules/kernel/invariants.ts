/**
 * Greenfield shell invariants — align with docs/platform/frontend-architecture.md.
 * Legacy design/shellInvariants.ts remains until /runs cutover.
 */
export const SHELL_GREENFIELD_INVARIANTS = {
  client: 'Thin client of /v1/* — I8; no shadow factory in the browser',
  factory: 'One ACP swarm-factory — no bot marketplace or per-playbook agents',
  engagement: 'Chat-shaped theater; domain model is EngagementEvent + Matter',
  identity: 'Foreman + Operator portraits; Muse presence without companion pet',
  climax: 'Structured artifact from API result — not chat thank-you',
  ia: 'Home · Jobs · Matters · Practices · Briefs · People · Workspaces · Develop',
  tokens: 'design/tokens.css via CSS variables; firm lavender atmosphere',
  deploy: 'Static SPA; API via VITE_GANTRY_API_URL',
} as const;

export type GreenfieldInvariantKey = keyof typeof SHELL_GREENFIELD_INVARIANTS;
