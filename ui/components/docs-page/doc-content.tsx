'use client';

import React from 'react';
import { DOCS } from './doc-data';

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              style={{
                fontFamily: 'monospace',
                fontSize: '0.85em',
                background: 'var(--surface-raised)',
                padding: '0.1em 0.35em',
                borderRadius: '4px',
                border: '1px solid var(--border)',
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </>
  );
}

function DocBody({ body }: { body: string }) {
  const lines = body.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let k = 0; // independent key counter — never reuses a value regardless of how i moves

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('# ')) {
      elements.push(
        <h1
          key={k++}
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            marginBottom: '0.5rem',
            marginTop: 0,
          }}
        >
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2
          key={k++}
          style={{
            fontSize: '1.2rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            marginTop: '2rem',
            marginBottom: '0.5rem',
            paddingBottom: '0.375rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3
          key={k++}
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            marginTop: '1.5rem',
            marginBottom: '0.375rem',
          }}
        >
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre
          key={k++}
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            overflowX: 'auto',
            fontSize: '0.8125rem',
            lineHeight: 1.6,
            margin: '1rem 0',
            fontFamily: 'monospace',
          }}
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
    } else if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={k++} style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: '0.25rem' }}>
              {inlineFormat(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() === '') {
      elements.push(<div key={k++} style={{ height: '0.5rem' }} />);
    } else {
      elements.push(
        <p key={k++} style={{ margin: '0.5rem 0' }}>
          {inlineFormat(line)}
        </p>
      );
    }
    i++;
  }

  return <>{elements}</>;
}

export function DocContent({ activeSlug }: { activeSlug: string }) {
  const doc = DOCS[activeSlug] ?? DOCS['introduction'];
  return (
    <main
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '2.5rem 3rem',
        maxWidth: 760,
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
  );
}
