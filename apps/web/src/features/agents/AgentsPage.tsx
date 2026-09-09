import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  GitPullRequest,
  Hand,
  Layers,
  MessageSquare,
  ScanSearch,
  Settings2,
  Shield,
  Target,
  Users,
  Wrench,
} from 'lucide-react';
import { gantryClient, type AgentCatalog, type CrewAgent } from '@/shared/services/gantry/client';
import {
  FACTORY_CAPABILITIES,
  PLAYBOOK_OPTIONS,
  RUN_SIZE_OPTIONS,
  playbookHint,
} from '@/shared/constants/runConfig';
import {
  DISABLEABLE_AGENTS,
  getPipelineDefaults,
  savePipelineDefaults,
  type PipelineDefaults,
} from '@/shared/services/gantry/pipelineDefaults';
import './AgentsPage.css';

const CREW_ICON: Record<string, LucideIcon> = {
  Foreman: Target,
  PM: ClipboardList,
  Architect: Layers,
  Builder: Wrench,
  Inspector: ScanSearch,
  Reviewer: Eye,
  Security: Shield,
  DevOps: GitPullRequest,
  'HITL Approval': Hand,
  'HITL Clarification': MessageSquare,
};

function CrewRoleIcon({ role }: { role: string }) {
  const Icon = CREW_ICON[role] ?? Bot;
  return <Icon size={18} />;
}

function friendlyCrewSummary(agent: CrewAgent): string {
  const summaries: Record<string, string> = {
    Foreman: 'Coordinates the whole run from your task message to a finished PR.',
    PM: 'Turns your goal into a clear plan and asks questions when needed.',
    Architect: 'Maps the repo and splits work into sensible chunks.',
    Builder: 'Writes and updates code on one workstream at a time.',
    Inspector: 'Runs tests and lint, then tries to fix what breaks.',
    Reviewer: 'Reads the full diff and flags logic issues.',
    Security: 'Looks for leaked secrets and risky dependencies.',
    DevOps: 'Creates the branch, commits, pushes, and opens the PR.',
    'HITL Approval': 'Pauses for your OK before continuing.',
    'HITL Clarification': 'Pauses to ask you a question mid-run.',
  };
  return summaries[agent.role] ?? agent.description;
}

export function AgentsPage() {
  const [catalog, setCatalog] = useState<AgentCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<PipelineDefaults>(() => getPipelineDefaults());
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await gantryClient.listAgents();
        if (!cancelled) setCatalog(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTeamMember = (id: string, included: boolean) => {
    setDefaults(prev => {
      const disable = new Set(prev.disable_agents);
      if (included) disable.delete(id);
      else disable.add(id);
      return { ...prev, disable_agents: [...disable] };
    });
    setSaved(false);
  };

  const handleSave = () => {
    savePipelineDefaults(defaults);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const selectedRunSize = RUN_SIZE_OPTIONS.find(o => o.value === defaults.tier) ?? RUN_SIZE_OPTIONS[0];

  return (
    <div className="agents-page">
      <header className="agents-header">
        <div>
          <h1 className="agents-title">Team</h1>
          <p className="agents-subtitle">
            Configure how factory runs behave — run size, playbook, quality gates, and optional roles.
            These defaults apply to every new task from the home screen.
          </p>
        </div>
      </header>

      <section className="agents-card agents-capabilities">
        <h2 className="agents-capabilities-title">What a run does</h2>
        <ul className="agents-capabilities-list">
          {FACTORY_CAPABILITIES.map(item => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </li>
          ))}
        </ul>
        <p className="agents-integrations-note">
          Headless triggers (GitHub label <code>gantry</code>, Linear/Jira, bulk API) use the same pipeline —
          see <code>docs/integrations/</code> in the repo.
        </p>
      </section>

      <section className="agents-card">
        <div className="agents-card-head">
          <Settings2 size={18} />
          <h2>Default run profile</h2>
        </div>
        <p className="agents-card-lead">Applied when you submit a goal from New Task or a hubspace.</p>

        <div className="agents-playbooks">
          <span className="agents-label">Playbook</span>
          <div className="agents-playbook-grid">
            {PLAYBOOK_OPTIONS.map(opt => (
              <button
                key={opt.id || 'general'}
                type="button"
                className={`agents-playbook-btn ${defaults.playbook === opt.id ? 'active' : ''}`}
                onClick={() => {
                  setDefaults(prev => ({ ...prev, playbook: opt.id }));
                  setSaved(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="agents-run-size-hint">{playbookHint(defaults.playbook || null)}</p>
        </div>

        <div className="agents-run-size">
          <span className="agents-label">Run size (tier)</span>
          <div className="agents-run-size-grid">
            {RUN_SIZE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`agents-run-size-btn ${defaults.tier === opt.value ? 'active' : ''}`}
                onClick={() => {
                  setDefaults(prev => ({ ...prev, tier: opt.value }));
                  setSaved(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="agents-run-size-hint">{selectedRunSize.hint}</p>
        </div>

        <div className="agents-team-toggles">
          <span className="agents-label">Optional roles</span>
          <p className="agents-team-lead">
            Foreman, Architect, Builder, and DevOps always run. Toggle specialists off for faster, cheaper runs.
          </p>
          <div className="agents-team-grid">
            {DISABLEABLE_AGENTS.map(member => {
              const on = !defaults.disable_agents.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  className={`agents-team-card ${on ? 'on' : 'off'}`}
                  onClick={() => toggleTeamMember(member.id, !on)}
                  aria-pressed={on}
                >
                  <span className="agents-team-card-top">
                    <span className="agents-team-name">{member.label}</span>
                    <span className={`agents-team-pill ${on ? 'on' : 'off'}`}>{on ? 'On' : 'Off'}</span>
                  </span>
                  <span className="agents-team-desc">{member.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="agents-advanced-toggle"
          onClick={() => setShowAdvanced(v => !v)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Fine-tuning
        </button>

        {showAdvanced && (
          <div className="agents-advanced">
            <div className="agents-field">
              <label htmlFor="tracks">Parallel workstreams</label>
              <input
                id="tracks"
                type="number"
                min={1}
                max={8}
                placeholder="Use run-size default"
                value={defaults.max_parallel_tracks ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  setDefaults(prev => ({
                    ...prev,
                    max_parallel_tracks: v === '' ? undefined : Number(v),
                  }));
                  setSaved(false);
                }}
              />
            </div>
            <div className="agents-field">
              <label htmlFor="heals">Auto-fix attempts</label>
              <input
                id="heals"
                type="number"
                min={0}
                max={5}
                placeholder="Use run-size default"
                value={defaults.max_heal_cycles ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  setDefaults(prev => ({
                    ...prev,
                    max_heal_cycles: v === '' ? undefined : Number(v),
                  }));
                  setSaved(false);
                }}
              />
            </div>
            <div className="agents-field">
              <label htmlFor="lightweight">Fast mode</label>
              <select
                id="lightweight"
                value={defaults.lightweight_mode == null ? '' : defaults.lightweight_mode ? '1' : '0'}
                onChange={e => {
                  const v = e.target.value;
                  setDefaults(prev => ({
                    ...prev,
                    lightweight_mode: v === '' ? undefined : v === '1',
                  }));
                  setSaved(false);
                }}
              >
                <option value="">Use run-size default</option>
                <option value="1">On — skip extra steps when possible</option>
                <option value="0">Off — full process</option>
              </select>
            </div>
          </div>
        )}

        <div className="agents-save-row">
          <button type="button" className="agents-save-btn" onClick={handleSave}>
            Save settings
          </button>
          {saved && <span className="agents-saved-msg">Saved for your next task</span>}
        </div>
      </section>

      <section className="agents-card">
        <div className="agents-card-head">
          <Users size={18} />
          <h2>Pipeline roles</h2>
        </div>
        <p className="agents-card-lead">
          Specialists invoked by the Foreman during a run (read-only reference from the API catalog).
        </p>

        {loading && (
          <div className="agents-loading">
            <div className="spinner" />
          </div>
        )}
        {error && <p className="agents-error">Couldn&apos;t load the team list. {error}</p>}

        {catalog && (
          <div className="agents-crew-grid">
            {catalog.agents.map((agent: CrewAgent) => (
              <article key={agent.name} className="agents-crew-card">
                <div className="agents-crew-icon" aria-hidden>
                  <CrewRoleIcon role={agent.role} />
                </div>
                <div className="agents-crew-body">
                  <h3 className="agents-crew-name">{agent.role}</h3>
                  <p className="agents-crew-desc">{friendlyCrewSummary(agent)}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
