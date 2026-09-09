import { useEffect, useMemo, useRef } from 'react';
import { highlightCode, languageLabel } from './codeHighlight';
import 'highlight.js/styles/github.css';
import './CodeViewer.css';

type Props = {
  relPath: string;
  content: string;
  isActive?: boolean;
};

export function CodeViewer({ relPath, content, isActive = false }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const highlighted = useMemo(() => highlightCode(content, relPath), [content, relPath]);

  const lines = content.split('\n');

  useEffect(() => {
    if (isActive) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [content, isActive]);

  return (
    <div className="code-viewer">
      <div className="code-viewer-scroll">
        <div
          className="code-viewer-gutter"
          style={{ minWidth: `${Math.max(String(lines.length).length * 0.55 + 0.75, 2)}rem` }}
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {highlighted ? (
          <pre className="code-viewer-pre">
            <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />
          </pre>
        ) : (
          <pre className="code-viewer-pre code-viewer-plain">{content}</pre>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="code-viewer-footer">
        <span>{relPath}</span>
        <span>{languageLabel(relPath)}</span>
      </div>
    </div>
  );
}
