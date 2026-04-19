'use client';

import { useAgentConfigStore, DEFAULT_CONFIG, type AgentModel } from '@/lib/agent-config-store';

const MODEL_OPTIONS: { value: AgentModel; label: string }[] = [
  { value: 'default', label: 'Default (Sonnet 4.6)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (cheaper)' },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '0.6875rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--text-secondary)',
      marginBottom: '0.875rem',
    }}>
      {children}
    </p>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.625rem 0',
      borderBottom: '1px solid var(--border)',
      gap: '1rem',
    }}>
      <div>
        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</p>
        {hint && <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{hint}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function SliderInput({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 100, accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', minWidth: 24, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        background: checked ? 'var(--accent)' : 'var(--surface-raised)',
        border: '1px solid ' + (checked ? 'var(--accent)' : 'var(--border)'),
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.15s, border 0.15s',
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: checked ? 20 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function Select({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        fontSize: '0.8125rem',
        color: 'var(--text-primary)',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '0.3rem 0.5rem',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function ConfigPanel() {
  const { config, setConfig, resetConfig, isDirty } = useAgentConfigStore();
  const dirty = isDirty();

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '2.5rem 2rem' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            Configuration
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Tune agent behavior without touching code.
          </p>
        </div>
        {dirty && (
          <button
            onClick={resetConfig}
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.375rem 0.75rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Reset to defaults
          </button>
        )}
      </div>

      {/* Research pipeline */}
      <div style={{ marginBottom: '2rem' }}>
        <SectionLabel>Research Pipeline</SectionLabel>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 1rem' }}>
          <SettingRow label="Max analysts per task" hint="How many Analyst agents read sources in parallel">
            <SliderInput value={config.maxAnalysts} min={2} max={8} onChange={v => setConfig({ maxAnalysts: v })} />
          </SettingRow>
          <SettingRow label="Max verifiers per task" hint="Verifiers only spawn for claims the Critic flags">
            <SliderInput value={config.maxVerifiers} min={1} max={5} onChange={v => setConfig({ maxVerifiers: v })} />
          </SettingRow>
          <SettingRow label="Analyst depth" hint="Shallow: 3 pages · Deep: 8 pages per analyst">
            <Select
              value={config.analystDepth}
              options={[{ value: 'shallow', label: 'Shallow (faster)' }, { value: 'deep', label: 'Deep (thorough)' }]}
              onChange={v => setConfig({ analystDepth: v as 'shallow' | 'deep' })}
            />
          </SettingRow>
        </div>
      </div>

      {/* Execution pipeline */}
      <div style={{ marginBottom: '2rem' }}>
        <SectionLabel>Execution Pipeline</SectionLabel>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 1rem' }}>
          <SettingRow label="Require approval for irreversible steps" hint="Gate destructive actions (form submissions, API writes)">
            <Toggle checked={config.requireApprovalForIrreversible} onChange={v => setConfig({ requireApprovalForIrreversible: v })} />
          </SettingRow>
          <SettingRow label="Max execution steps" hint="Guards against runaway task plans">
            <SliderInput value={config.maxExecutionSteps} min={1} max={20} onChange={v => setConfig({ maxExecutionSteps: v })} />
          </SettingRow>
          <SettingRow label="HTTP timeout (seconds)" hint="Per http_request activity call">
            <SliderInput value={config.httpTimeoutSeconds} min={10} max={120} onChange={v => setConfig({ httpTimeoutSeconds: v })} />
          </SettingRow>
        </div>
      </div>

      {/* Model selection */}
      <div style={{ marginBottom: '2rem' }}>
        <SectionLabel>Model per Role</SectionLabel>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 1rem' }}>
          {(
            [
              { key: 'modelStrategist', label: 'Strategist', hint: 'Planning — benefits from Sonnet' },
              { key: 'modelCritic', label: 'Critic', hint: 'Contradiction detection — keep Sonnet' },
              { key: 'modelTaskPlanner', label: 'TaskPlanner', hint: 'JSON plan generation — keep Sonnet' },
              { key: 'modelAnalyst', label: 'Analyst', hint: 'Claim extraction — Haiku is viable' },
              { key: 'modelScout', label: 'Scout', hint: 'Query planning — Haiku is fine' },
              { key: 'modelVerifier', label: 'Verifier', hint: 'Fact checking — Haiku is viable' },
            ] as { key: keyof typeof config; label: string; hint: string }[]
          ).map(({ key, label, hint }) => (
            <SettingRow key={key} label={label} hint={hint}>
              <Select
                value={config[key] as string}
                options={MODEL_OPTIONS}
                onChange={v => setConfig({ [key]: v as AgentModel })}
              />
            </SettingRow>
          ))}
        </div>
      </div>

      {/* Display */}
      <div>
        <SectionLabel>Display</SectionLabel>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 1rem' }}>
          <SettingRow label="Show agent tags in message feed" hint="Shows [Scout], [Agent N], [Executor N] prefixes">
            <Toggle checked={config.showAgentTagsInFeed} onChange={v => setConfig({ showAgentTagsInFeed: v })} />
          </SettingRow>
          <SettingRow label="Show raw claims before synthesis" hint="Stream individual claims as analysts extract them">
            <Toggle checked={config.showRawClaimsBeforeSynthesis} onChange={v => setConfig({ showRawClaimsBeforeSynthesis: v })} />
          </SettingRow>
        </div>
      </div>

    </div>
  );
}
