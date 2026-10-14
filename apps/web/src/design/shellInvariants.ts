/**
 * Muse / iMessage shell invariants for Gantry greenfield.
 */
export const SHELL_INVARIANTS = {
  architecture:
    'Messaging app — conversation list + chat canvas. No product tab bar (Home/Matters/Practices…).',
  entity: 'Message bubbles; Foreman presence in chat header with live snippet — entity, not search box',
  threads: 'Main firm chat + matter side-chats in thread list (iMessage pattern)',
  secondary: 'Goals / Floor / Menu open as sheets over chat — never primary destinations',
  client: 'Thin client of /v1/* — I8; no shadow factory in the browser',
  factory: 'One ACP swarm-factory — no bot marketplace',
  climax: 'Structured artifact + HITL cards in-thread',
  identity: 'Foreman anchor + Operator floor sheet; Muse presence without companion pet',
  tokens: 'design/tokens.css imported by index.css',
  deploy: 'deploy/invariants.ts + deploy/env.ts; vercel.json SPA rewrites; no API on Vercel',
} as const;

export type ShellInvariantKey = keyof typeof SHELL_INVARIANTS;
