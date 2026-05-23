'use client';

import { useState } from 'react';
import { AgentDirectory } from '@/components/agents/agent-directory';
import { ConfigPanel } from '@/components/agents/config-panel';
import { ApiKeysPanel } from '@/components/agents/api-keys-panel';
import { useAgentConfigStore } from '@/lib/agent-config-store';

type Tab = 'directory' | 'settings' | 'api';

const TABS: { id: Tab; label: string }[] = [
  { id: 'directory', label: 'Directory' },
  { id: 'settings', label: 'Settings' },
  { id: 'api', label: 'API' },
];

export default function AgentsPage() {
  const [tab, setTab] = useState<Tab>('directory');
  const isDirty = useAgentConfigStore(s => s.isDirty());

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>

      {/* Tab bar */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.125rem',
        position: 'sticky',
        top: 0,
        background: 'var(--background)',
        zIndex: 10,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              position: 'relative',
              padding: '0.875rem 0.75rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'inherit',
              transition: 'color 0.12s ease',
            }}
          >
            {t.label}
            {t.id === 'settings' && isDirty && (
              <span style={{
                position: 'absolute',
                top: 10,
                right: 4,
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'var(--accent)',
              }} />
            )}
            {tab === t.id && (
              <span style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 2,
                background: 'var(--accent)',
                borderRadius: '2px 2px 0 0',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'directory' && <AgentDirectory />}
      {tab === 'settings' && <ConfigPanel />}
      {tab === 'api' && <ApiKeysPanel />}
    </div>
  );
}
