'use client';

import React from 'react';
import { DOC_TREE } from './doc-data';

interface DocTreeProps {
  activeSlug: string;
  onSelect: (slug: string) => void;
}

export function DocTree({ activeSlug, onSelect }: DocTreeProps) {
  return (
    <nav
      style={{
        width: 220,
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
        Documentation
      </p>
      {DOC_TREE.map(section => (
        <div key={section.slug} style={{ marginBottom: '0.25rem' }}>
          <button
            onClick={() => {
              if (!section.children) onSelect(section.slug);
            }}
            style={
              {
                width: '100%',
                textAlign: 'left',
                border: 'none',
                padding: '0.35rem 0.5rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8375rem',
                fontWeight: section.children ? 600 : 400,
                color:
                  activeSlug === section.slug
                    ? 'var(--accent)'
                    : 'var(--text-primary)',
                fontFamily: 'inherit',
                background:
                  activeSlug === section.slug
                    ? 'var(--surface-raised)'
                    : 'transparent',
              } as React.CSSProperties
            }
          >
            {section.title}
          </button>
          {section.children && (
            <div style={{ paddingLeft: '0.75rem', marginTop: '0.125rem' }}>
              {section.children.map(child => (
                <button
                  key={child.slug}
                  onClick={() => onSelect(child.slug)}
                  style={
                    {
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      padding: '0.3rem 0.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontFamily: 'inherit',
                      color:
                        activeSlug === child.slug
                          ? 'var(--accent)'
                          : 'var(--text-secondary)',
                      background:
                        activeSlug === child.slug
                          ? 'var(--surface-raised)'
                          : 'transparent',
                      fontWeight: activeSlug === child.slug ? 500 : 400,
                    } as React.CSSProperties
                  }
                >
                  {child.title}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
