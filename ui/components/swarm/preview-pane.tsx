'use client';

import { useState } from 'react';

export function PreviewPane({
  url,
  manualUrl,
  onUrlChange,
}: {
  url: string;
  manualUrl: string;
  onUrlChange: (v: string) => void;
}) {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.375rem 0.625rem', borderBottom: '1px solid var(--border)',
        background: 'var(--background)', flexShrink: 0,
      }}>
        <input
          value={manualUrl}
          onChange={e => onUrlChange(e.target.value)}
          placeholder={url ? url : 'http://localhost:3000'}
          style={{
            flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '5px', padding: '0.25rem 0.5rem',
            fontSize: '0.75rem', color: 'var(--text-primary)', fontFamily: 'monospace',
            outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          onKeyDown={e => { if (e.key === 'Enter') setReloadKey(k => k + 1); }}
        />
        <button
          onClick={() => setReloadKey(k => k + 1)}
          title="Reload"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '0.2rem 0.3rem',
            borderRadius: '4px', lineHeight: 1,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          ↺
        </button>
      </div>

      {url ? (
        <iframe
          key={reloadKey}
          src={url}
          style={{ flex: 1, border: 'none', background: '#fff' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
          color: 'var(--text-secondary)',
        }}>
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.25} strokeLinecap="round" style={{ opacity: 0.25 }}>
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          <p style={{ fontSize: '0.8rem', opacity: 0.4 }}>No preview URL yet</p>
          <p style={{ fontSize: '0.72rem', opacity: 0.3 }}>
            Enter a URL above or wait for the builder to start a dev server
          </p>
        </div>
      )}
    </div>
  );
}
