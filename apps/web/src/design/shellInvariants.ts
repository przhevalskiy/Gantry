/**
 * Greenfield firm-shell invariants (Muse-like L5 theater).
 * Legacy compose/IDE console invariants retired with features/* cutover.
 */
export const SHELL_INVARIANTS = {
  client: 'Thin client of /v1/* — I8; no shadow factory in the browser',
  factory: 'One ACP swarm-factory — no bot marketplace or per-playbook agents',
  engagement: 'Chat-shaped theater; domain model is EngagementEvent + Matter',
  identity: 'Foreman + Operator portraits; Muse presence without companion pet',
  climax: 'Structured artifact from API result — not chat thank-you',
  ia: 'Home · Jobs/Matters · Practices · Briefs · People · Workspaces · Develop',
  layout: 'FirmShell top nav + full-bleed Home / Engagement theater — not ops sidebar console',
  tokens: 'design/tokens.css imported by index.css',
  deploy: 'deploy/invariants.ts + deploy/env.ts; vercel.json SPA rewrites; no API on Vercel',
} as const;

export type ShellInvariantKey = keyof typeof SHELL_INVARIANTS;
