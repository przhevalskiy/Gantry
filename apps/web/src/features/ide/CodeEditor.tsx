import { useEffect, useMemo, useRef } from 'react';
import { highlightCode, languageLabel } from './codeHighlight';
import 'highlight.js/styles/github.css';
import './CodeEditor.css';

type Props = {
  relPath: string;
  content: string;
  onChange: (value: string) => void;
};

export function CodeEditor({ relPath, content, onChange }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const highlighted = useMemo(() => highlightCode(content, relPath), [content, relPath]);
  const lines = content.split('\n');

  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  useEffect(() => {
    syncScroll();
  }, [content]);

  return (
    <div className="code-editor">
      <div className="code-editor-scroll">
        <div
          ref={gutterRef}
          className="code-editor-gutter"
          style={{ minWidth: `${Math.max(String(lines.length).length * 0.55 + 0.75, 2)}rem` }}
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        <div className="code-editor-body">
          <pre ref={preRef} className="code-editor-pre" aria-hidden="true">
            {highlighted ? (
              <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted + '\n' }} />
            ) : (
              <code>{content}</code>
            )}
          </pre>
          <textarea
            ref={textareaRef}
            className="code-editor-input"
            value={content}
            spellCheck={false}
            onChange={e => onChange(e.target.value)}
            onScroll={syncScroll}
          />
        </div>
      </div>

      <div className="code-editor-footer">
        <span>{relPath}</span>
        <span>{languageLabel(relPath)}</span>
      </div>
    </div>
  );
}
