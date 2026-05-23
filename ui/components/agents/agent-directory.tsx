'use client';

import { AgentCard, type AgentDef } from './agent-card';

const SWARM_AGENTS: AgentDef[] = [
  {
    step: 1,
    role: 'Foreman',
    tagline: 'The durable orchestrator. Scores complexity, dispatches each stage in sequence, manages the heal loop, and blocks the PR if security fails.',
    why: 'The single source of truth for pipeline state. If the process dies mid-run, Temporal rehydrates the Foreman and it continues from the last checkpoint.',
    tools: ['Temporal workflow'],
    mode: 'swarm',
    color: '#6366f1',
    spriteRole: 'foreman',
  },
  {
    step: 2,
    role: 'PM',
    tagline: 'Translates the goal into a scoped specification: clarifies ambiguities, identifies risks, and defines acceptance criteria before any code runs.',
    why: 'Without a PM gate, builders hallucinate scope. One LLM call up front prevents wasted cycles downstream.',
    tools: ['read_file', 'list_directory', 'clarify', 'report_spec'],
    mode: 'swarm',
    color: '#0ea5e9',
    spriteRole: 'foreman',
  },
  {
    step: 3,
    role: 'Architect',
    tagline: 'Reads the repo, maps dependencies and entry points, and produces a structured file-level implementation plan.',
    why: 'Builders should never guess at structure. The Architect reads first so each Builder writes with full context.',
    tools: ['list_directory', 'read_file', 'report_plan'],
    mode: 'swarm',
    color: '#0ea5e9',
    spriteRole: 'architect',
  },
  {
    step: 4,
    role: 'Builder',
    tagline: 'Executes the Architect\'s plan — creating, patching, and deleting files. Multiple Builders run in parallel across tracks. Re-invoked with heal instructions if QA fails.',
    why: 'Code writing is isolated from planning and testing. Parallel tracks compress wall-clock time on multi-file changes.',
    tools: ['read_file', 'write_file', 'patch_file', 'delete_file', 'run_command'],
    mode: 'swarm',
    color: '#8b5cf6',
    spriteRole: 'builder',
  },
  {
    step: 5,
    role: 'Inspector',
    tagline: 'Runs tests, lint, and type checks. If anything fails, produces concrete heal_instructions fed back to the Builder.',
    why: 'The self-healing loop. Up to N cycles of Builder → Inspector until all checks pass or the limit is hit.',
    tools: ['run_tests', 'run_lint', 'run_type_check', 'read_file'],
    mode: 'swarm',
    color: '#f59e0b',
    spriteRole: 'inspector',
  },
  {
    step: 6,
    role: 'Reviewer',
    tagline: 'Reads the diff and checks logic correctness, edge-case handling, and API contract compliance. If changes are needed, feeds back into the heal loop.',
    why: 'Tests can pass and logic can still be wrong. The Reviewer is the only agent that asks: "does this actually do what was asked?"',
    tools: ['git_diff', 'read_file', 'report_review'],
    mode: 'swarm',
    color: '#a855f7',
    spriteRole: 'inspector',
  },
  {
    step: 7,
    role: 'Security',
    tagline: 'Scans for committed secrets, vulnerable dependencies, and insecure patterns. Blocks the PR if critical or high findings exist.',
    why: 'A hard gate before any code reaches a PR. No critical finding goes unreviewed.',
    tools: ['scan_secrets', 'scan_dependencies', 'run_sast', 'read_file'],
    mode: 'swarm',
    color: '#ef4444',
    spriteRole: 'security',
  },
  {
    step: 8,
    role: 'DevOps',
    tagline: 'Creates the branch, stages only the build\'s changed files, commits with a conventional message, pushes, and opens a pull request.',
    why: 'Git operations are deterministic and isolated. The swarm never touches main directly.',
    tools: ['git_status', 'git_create_branch', 'git_add', 'git_commit', 'git_push', 'create_pull_request'],
    mode: 'swarm',
    color: '#16a34a',
    spriteRole: 'devops',
  },
];

const PIPELINE_SWARM = ['Foreman', 'PM', 'Architect', 'Builders ×N', 'Inspector ↺', 'Reviewer', 'Security', 'DevOps'];

export function AgentDirectory() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2.5rem 2rem' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.375rem' }}>
          Swarm Factory
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Role-differentiated agents running in a durable Temporal pipeline. Each agent has exactly the tools it needs and nothing more.
        </p>
      </div>

      {/* Pipeline diagram */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 }}>
          {PIPELINE_SWARM.map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{
                fontSize: '0.8rem', fontWeight: 500,
                color: 'var(--text-primary)',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0.25rem 0.6rem',
                whiteSpace: 'nowrap',
              }}>
                {step}
              </span>
              {i < PIPELINE_SWARM.length - 1 && (
                <span style={{ color: 'var(--text-secondary)', padding: '0 0.25rem', fontSize: '0.75rem' }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Agent cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem' }}>
        {SWARM_AGENTS.map(a => <AgentCard key={a.role} agent={a} />)}
      </div>

    </div>
  );
}
