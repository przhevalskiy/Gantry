import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import 'flowtoken/dist/styles.css';
import { Copy, Check, Loader2, RotateCcw, Bot } from 'lucide-react';
import { getAvatarIcon } from '@/shared/constants/avatarIcons';
import { Message } from '@/shared/types';
import { useState, useMemo, memo, useCallback } from 'react';
import { useAuthStore } from '@/features/auth';
import { ChecklistMessage } from './ChecklistMessage';
import './ChatMessage.css';

const listEmojis = [
  '✅', '❌', '✓', '✗', '•', '◦', '▪', '▫', '►', '▸',
  '🔥', '⚡', '🌿', '💡', '🎯', '🚀', '⭐', '🔴', '🟢', '🔵',
  '🟡', '🟠', '🟣', '⚪', '⚫', '📌', '📍', '🔸', '🔹', '🔶',
  '🔷', '💎', '🏆', '🎉', '🎊', '✨', '💫', '🌟', '⚠️', '❗',
  '❓', '❕', '❔', '➡️', '➜', '→', '⇒', '▶️', '☑️', '☐',
  '☒', '🔘', '🔲', '🔳', '⬛', '⬜', '🟥', '🟧', '🟨', '🟩',
  '🟦', '🟪', '⏩', '⏭️', '👉', '👆', '👇', '☀️', '🌙', '💰',
  '📊', '📈', '📉', '🔑', '🔒', '🔓', '💪', '🤝', '👍', '👎'
];

const emojiPattern = listEmojis.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const emojiMatchRegex = new RegExp(`(${emojiPattern})\\s+[^${emojiPattern}]+`, 'g');
const emojiSplitRegex = new RegExp(`(?=${emojiPattern}\\s)`, 'g');
const listItemRegex = /^[-*+]\s/;
const numberedListRegex = /^\d+\.\s/;
const emojiListLineRegex = /^- [^\s]/;
const emojiSet = new Set(listEmojis);

function startsWithEmoji(text: string): boolean {
  for (let i = 1; i <= 4 && i <= text.length; i++) {
    if (emojiSet.has(text.slice(0, i))) return true;
  }
  return false;
}

function normalizeBulletPoints(content: string): string {
  return content.replace(/^[•·] /gm, '- ');
}

function processEmojiLists(content: string): string {
  const lines = content.split('\n');
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    emojiMatchRegex.lastIndex = 0;
    const emojiMatches = line.match(emojiMatchRegex);

    if (emojiMatches && emojiMatches.length > 1) {
      const items = line.split(emojiSplitRegex).filter(Boolean);
      items.forEach(item => {
        const trimmed = item.trim();
        if (trimmed) {
          if (startsWithEmoji(trimmed)) {
            processedLines.push(`- ${trimmed}`);
          } else {
            processedLines.push(trimmed);
          }
        }
      });
    } else {
      const trimmedLine = line.trim();
      const hasEmoji = startsWithEmoji(trimmedLine);
      const isAlreadyListItem = listItemRegex.test(trimmedLine) || numberedListRegex.test(trimmedLine);

      if (hasEmoji && !isAlreadyListItem && trimmedLine.length > 2) {
        const prevLine = processedLines[processedLines.length - 1];
        const prevIsEmojiList = prevLine && emojiListLineRegex.test(prevLine);

        if (prevIsEmojiList || (i > 0 && startsWithEmoji(lines[i - 1].trim()))) {
          processedLines.push(`- ${trimmedLine}`);
        } else {
          processedLines.push(line);
        }
      } else {
        processedLines.push(line);
      }
    }
  }

  return processedLines.join('\n');
}

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onRetry?: (content: string) => void;
  onQuestionClick?: (question: string) => void;
  onSend?: (msg: string) => void;
  onHitlDecision?: (fields: Record<string, string>, approved: boolean) => void;
}

const intentLabels: Record<string, string> = {
  research:     'Research',
  event:        'Event',
  media:        'Media',
  social_media: 'Social Media',
  other:        'General',
};

const markdownComponents = {
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    const isInline = !className;
    if (isInline) {
      return <code className="inline-code" {...props}>{children}</code>;
    }
    return (
      <pre className="code-block">
        <code {...props}>{children}</code>
      </pre>
    );
  },
  p({ children }: { children?: React.ReactNode }) { return <p>{children}</p>; },
  ul({ children }: { children?: React.ReactNode }) { return <ul>{children}</ul>; },
  ol({ children }: { children?: React.ReactNode }) { return <ol>{children}</ol>; },
  li({ children }: { children?: React.ReactNode }) { return <li>{children}</li>; },
  a({ href, children }: { href?: string; children?: React.ReactNode }) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  },
  table({ children }: { children?: React.ReactNode }) {
    return <table className="markdown-table">{children}</table>;
  },
  thead({ children }: { children?: React.ReactNode }) { return <thead>{children}</thead>; },
  tbody({ children }: { children?: React.ReactNode }) { return <tbody>{children}</tbody>; },
  tr({ children }: { children?: React.ReactNode }) { return <tr>{children}</tr>; },
  th({ children }: { children?: React.ReactNode }) { return <th>{children}</th>; },
  td({ children }: { children?: React.ReactNode }) { return <td>{children}</td>; },
  hr() { return <hr />; },
  h1({ children }: { children?: React.ReactNode }) { return <h1>{children}</h1>; },
  h2({ children }: { children?: React.ReactNode }) { return <h2>{children}</h2>; },
  h3({ children }: { children?: React.ReactNode }) { return <h3>{children}</h3>; },
  h4({ children }: { children?: React.ReactNode }) { return <h4>{children}</h4>; },
};

const remarkPlugins = [remarkGfm, remarkBreaks];

function parseChecklistFields(content: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of content.split('\n').slice(1)) {
    const match = line.match(/^\*\*(.+?)\*\*:\s*(.+)$/);
    if (match) fields[match[1]] = match[2];
  }
  return fields;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isStreaming,
  onRetry,
  onQuestionClick,
  onSend,
  onHitlDecision,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const displayName = useAuthStore((s) => s.user?.user_metadata?.display_name) || useAuthStore((s) => s.user?.email?.split('@')[0]) || 'You';
  const AvatarIcon = getAvatarIcon(useAuthStore((s) => s.user?.user_metadata?.avatar_icon));
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const isChecklist = !isUser && message.content.startsWith('__checklist__');

  const processedContent = useMemo(
    () => (isStreaming || isChecklist) ? '' : processEmojiLists(normalizeBulletPoints(message.content)),
    [message.content, isStreaming, isChecklist]
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = useCallback(async () => {
    if (retrying || !onRetry) return;
    setRetrying(true);
    try {
      await onRetry(message.content);
    } finally {
      setRetrying(false);
    }
  }, [retrying, onRetry, message.content]);

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-avatar ${isUser ? 'user' : 'assistant'}`}>
        {isUser ? <AvatarIcon size={16} /> : <Bot size={16} />}
      </div>

      <div className="message-content">
        <div className="message-header">
          <span className="message-author">{isUser ? displayName : 'Gantry'}</span>
          {!isUser && message.intent && intentLabels[message.intent] && (
            <span className={`message-intent ${message.intent}`}>
              {intentLabels[message.intent]}
            </span>
          )}
          {message.response_time_ms && (
            <span className="message-time">
              {(message.response_time_ms / 1000).toFixed(1)}s
            </span>
          )}
          {!isStreaming && (
            <>
              {!isUser && onRetry && (
                <button className="message-retry" onClick={handleRetry} title="Retry" disabled={retrying}>
                  {retrying ? <Loader2 size={14} className="spinning" /> : <RotateCcw size={14} />}
                </button>
              )}
              <button className="message-copy" onClick={handleCopy} title="Copy">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </>
          )}
        </div>

        <div className={`message-body ${isStreaming ? 'streaming' : ''}`}>
          {isChecklist ? (
            <ChecklistMessage
              content={message.content}
              intent={message.intent}
              onConfirm={msg => onSend?.(msg)}
              onEdit={msg => onSend?.(msg)}
              onHitlDecision={approved =>
                onHitlDecision?.(parseChecklistFields(message.content), approved)
              }
            />
          ) : (
            <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents}>
              {isStreaming ? message.content : processedContent}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
});
