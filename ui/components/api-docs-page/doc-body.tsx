'use client';

import React from 'react';

export function inlineFormat(text: string): React.ReactNode {
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

export function DocBody({ body }: { body: string }) {
  const lines = body.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

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
    } else if (line.startsWith('| ')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!lines[i].match(/^\|[-| ]+\|$/)) {
          rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()));
        }
        i++;
      }
      if (rows.length > 0) {
        const [header, ...body] = rows;
        elements.push(
          <table
            key={k++}
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              margin: '1rem 0',
              fontSize: '0.85rem',
            }}
          >
            <thead>
              <tr>
                {header.map((cell, j) => (
                  <th
                    key={j}
                    style={{
                      textAlign: 'left',
                      padding: '0.4rem 0.75rem',
                      borderBottom: '2px solid var(--border)',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      fontSize: '0.775rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, j) => (
                <tr key={j} style={{ borderBottom: '1px solid var(--border)' }}>
                  {row.map((cell, m) => (
                    <td key={m} style={{ padding: '0.4rem 0.75rem' }}>
                      {inlineFormat(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      continue;
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
    } else if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote
          key={k++}
          style={{
            borderLeft: '3px solid var(--accent)',
            paddingLeft: '1rem',
            margin: '1rem 0',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
          }}
        >
          {quoteLines.map((ql, j) => (
            <p key={j} style={{ margin: '0.25rem 0' }}>
              {inlineFormat(ql)}
            </p>
          ))}
        </blockquote>
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
