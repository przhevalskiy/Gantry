'use client';

import { useEffect, useMemo, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('dockerfile', dockerfile);

const HLJS_STYLE = `
.hljs{color:#abb2bf}
.hljs-comment,.hljs-quote{color:#5c6370;font-style:italic}
.hljs-doctag,.hljs-keyword,.hljs-formula{color:#c678dd}
.hljs-section,.hljs-name,.hljs-selector-tag,.hljs-deletion,.hljs-subst{color:#e06c75}
.hljs-literal{color:#56b6c2}
.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string{color:#98c379}
.hljs-attr,.hljs-variable,.hljs-template-variable,.hljs-type,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo,.hljs-number{color:#d19a66}
.hljs-symbol,.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-title{color:#61afef}
.hljs-built_in,.hljs-title.class_,.hljs-class .hljs-title{color:#e6c07b}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:700}
.hljs-link{text-decoration:underline}
`;

export const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  py: 'python', html: 'html', css: 'css', json: 'json',
  sh: 'bash', yaml: 'yaml', yml: 'yaml', md: 'markdown',
  dockerfile: 'dockerfile',
};

export function CodeViewer({ relPath, content, isActive }: { relPath: string; content: string; isActive: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const ext = (relPath.split('/').pop() ?? relPath).split('.').pop()?.toLowerCase() ?? '';
  const lang = EXT_TO_LANG[ext];

  const highlighted = useMemo(() => {
    if (!lang) return null;
    try {
      return hljs.highlight(content, { language: lang }).value;
    } catch {
      return null;
    }
  }, [content, lang]);

  const lines = content.split('\n');

  useEffect(() => {
    if (isActive) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [content, isActive]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{HLJS_STYLE}</style>

      <div style={{ flex: 1, display: 'flex', overflow: 'auto', fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: '1.6rem' }}>
        <div style={{
          padding: '0.75rem 0.5rem 0.75rem 0', textAlign: 'right', userSelect: 'none',
          minWidth: `${Math.max(String(lines.length).length * 0.55 + 0.75, 2)}rem`,
          borderRight: '1px solid var(--border)',
          background: 'var(--background)',
          color: 'var(--text-secondary)', opacity: 0.35, flexShrink: 0,
        }}>
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {highlighted ? (
          <pre style={{ flex: 1, margin: 0, padding: '0.75rem 1.25rem', whiteSpace: 'pre', overflow: 'unset', background: 'transparent' }}>
            <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} style={{ background: 'transparent', padding: 0 }} />
          </pre>
        ) : (
          <pre style={{ flex: 1, margin: 0, padding: '0.75rem 1.25rem', color: 'var(--text-primary)', whiteSpace: 'pre', overflow: 'unset' }}>
            {content}
          </pre>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={{
        borderTop: '1px solid var(--border)', padding: '0.2rem 1rem',
        display: 'flex', gap: '1rem', background: 'var(--background)', flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.5, fontFamily: 'monospace' }}>
          {relPath}
        </span>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.4, fontFamily: 'monospace', marginLeft: 'auto' }}>
          {lang ? lang.toUpperCase() : ext.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
