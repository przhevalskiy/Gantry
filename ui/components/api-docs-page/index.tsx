'use client';

import { useState } from 'react';
import { SECTIONS, CONTENT } from './api-docs-data';
import { DocBody } from './doc-body';

export function ApiDocsPage() {
  const [activeSlug, setActiveSlug] = useState('overview');
  const doc = CONTENT[activeSlug] ?? CONTENT['overview'];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left nav */}
      <nav
        style={{
          width: 200,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          padding: '1.5rem 0.75rem',
          background: 'var(--surface)',
        }}
      >
        <p
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-secondary)',
            padding: '0 0.5rem',
            marginBottom: '0.75rem',
          }}
        >
          API Reference
        </p>
        {SECTIONS.map(section => (
          <button
            key={section.slug}
            onClick={() => setActiveSlug(section.slug)}
            style={
              {
                width: '100%',
                textAlign: 'left',
                border: 'none',
                display: 'block',
                padding: '0.35rem 0.5rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8375rem',
                fontFamily: 'inherit',
                color:
                  activeSlug === section.slug
                    ? 'var(--accent)'
                    : 'var(--text-primary)',
                background:
                  activeSlug === section.slug
                    ? 'var(--surface-raised)'
                    : 'transparent',
                fontWeight: activeSlug === section.slug ? 500 : 400,
                marginBottom: '0.125rem',
              } as React.CSSProperties
            }
          >
            {section.title}
          </button>
        ))}

        <div style={{ marginTop: '1.5rem', padding: '0 0.5rem' }}>
          <a
            href="http://localhost:8001/docs"
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '0.775rem',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <svg
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open Swagger UI
          </a>
        </div>
      </nav>

      {/* Content */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '2.5rem 3rem',
          maxWidth: 780,
        }}
      >
        <article
          style={{
            fontSize: '0.9rem',
            lineHeight: 1.75,
            color: 'var(--text-primary)',
          }}
        >
          <DocBody body={doc.body} />
        </article>
      </main>
    </div>
  );
}
