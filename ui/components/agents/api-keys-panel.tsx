'use client';

import { useState, useEffect, useCallback } from 'react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  active: boolean;
}

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

function MonoText({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem' }}>
      {children}
    </span>
  );
}

function CreatedKeyModal({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--background)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '2rem',
        maxWidth: 520,
        width: '90%',
      }}>
        <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>API key created</p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Copy it now — it won&apos;t be shown again.
        </p>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          wordBreak: 'break-all',
        }}>
          <MonoText>{apiKey}</MonoText>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={copy}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: copied ? 'var(--accent)' : 'var(--surface)',
              color: copied ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_GANTRY_URL ?? 'http://localhost:8001';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/keys`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch (e) {
      setError('Could not reach the Gantry API. Is it running?');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${apiBase}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setCreatedKey(data.key);
      setNewKeyName('');
      load();
    } catch {
      setError('Failed to create key.');
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    setRevoking(id);
    try {
      await fetch(`${apiBase}/keys/${id}`, { method: 'DELETE' });
      load();
    } catch {
      setError('Failed to revoke key.');
    } finally {
      setRevoking(null);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 680 }}>
      {createdKey && (
        <CreatedKeyModal apiKey={createdKey} onClose={() => setCreatedKey(null)} />
      )}

      <SectionLabel>API Keys</SectionLabel>

      {/* Create form */}
      <div style={{
        display: 'flex',
        gap: '0.625rem',
        marginBottom: '1.75rem',
      }}>
        <input
          value={newKeyName}
          onChange={e => setNewKeyName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createKey()}
          placeholder="Key name (e.g. github-actions)"
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          onClick={createKey}
          disabled={creating || !newKeyName.trim()}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 6,
            border: 'none',
            background: newKeyName.trim() ? 'var(--accent)' : 'var(--surface)',
            color: newKeyName.trim() ? '#fff' : 'var(--text-secondary)',
            cursor: newKeyName.trim() ? 'pointer' : 'default',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            fontWeight: 500,
            transition: 'background 0.12s',
          }}
        >
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </div>

      {/* Key list */}
      {loading && (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Loading…</p>
      )}
      {error && (
        <p style={{ fontSize: '0.875rem', color: 'var(--error, #e55)', marginBottom: '1rem' }}>{error}</p>
      )}
      {!loading && keys.length === 0 && !error && (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          No API keys yet. Create one above to start integrating.
        </p>
      )}
      {keys.map(k => (
        <div
          key={k.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 0',
            borderBottom: '1px solid var(--border)',
            gap: '1rem',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              {k.name}
            </p>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              <MonoText>{k.key_prefix}…</MonoText>
              {' · '}
              Created {formatDate(k.created_at)}
              {k.last_used_at && ` · Last used ${formatDate(k.last_used_at)}`}
            </p>
          </div>
          <button
            onClick={() => revokeKey(k.id)}
            disabled={revoking === k.id}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: 5,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            {revoking === k.id ? 'Revoking…' : 'Revoke'}
          </button>
        </div>
      ))}

      {/* Usage hint */}
      {keys.length > 0 && (
        <div style={{
          marginTop: '2rem',
          padding: '0.875rem 1rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
        }}>
          <SectionLabel>Usage</SectionLabel>
          <MonoText>
            {`curl -H "Authorization: Bearer <key>" ${process.env.NEXT_PUBLIC_GANTRY_URL ?? 'https://api.gantry.dev'}/v1/tasks`}
          </MonoText>
        </div>
      )}
    </div>
  );
}
