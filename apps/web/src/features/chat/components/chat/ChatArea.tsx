import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, X, Wrench, GitBranch, Layers, BookOpen, MessageCircle } from 'lucide-react';
import { useChatStore } from '../../store';
import { useDiscussionStore } from '@/features/discussions';
import { useAuthStore } from '@/features/auth';
import { useSSE } from '@/shared/hooks/useSSE';
import { FACTORY_STARTERS } from '@/shared/constants/factoryStarters';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatHeader } from './ChatHeader';
import { RotatingText } from '../ui/RotatingText';
import { ThinkingIndicator } from '../ui/ThinkingIndicator';
import './ChatArea.css';

function useRafScroll(containerRef: React.RefObject<HTMLDivElement | null>) {
  const rafRef = useRef<number | null>(null);

  const start = useCallback(() => {
    const loop = () => {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      rafRef.current = requestAnimationFrame(loop);
    };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(loop);
  }, [containerRef]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  return { start, stop };
}

interface ChatAreaProps {
  initialMessage?: string;
}

export function ChatArea({ initialMessage }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [hoverPrompt, setHoverPrompt] = useState('');
  const prevDiscussionIdRef = useRef<string | null>(null);
  const hasAutoSentRef = useRef(false);

  const { messages, isStreaming, isSubmitted, currentStreamContent, currentStreamIntent, persistedIntent, loadMessagesForDiscussion } = useChatStore();
  const { activeDiscussionId, discussions } = useDiscussionStore();
  const { sendMessage, resolveHitl, activeTaskId } = useSSE();
  const { start: startRafScroll, stop: stopRafScroll } = useRafScroll(messagesContainerRef);

  const currentDiscussion = discussions.find(d => d.id === activeDiscussionId);

  const handleRetry = useCallback(
    (messageId: string) => {
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex <= 0) return;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          sendMessage(messages[i].content);
          break;
        }
      }
    },
    [messages, sendMessage]
  );

  const handleQuestionClick = useCallback(
    (question: string) => sendMessage(question),
    [sendMessage]
  );

  useEffect(() => {
    if (prevDiscussionIdRef.current !== activeDiscussionId) {
      loadMessagesForDiscussion(activeDiscussionId);
      prevDiscussionIdRef.current = activeDiscussionId;
    }
  }, [activeDiscussionId, loadMessagesForDiscussion]);

  useEffect(() => {
    document.title = currentDiscussion?.title || 'Gantry';
  }, [currentDiscussion]);

  useEffect(() => {
    if (isStreaming) {
      startRafScroll();
    } else {
      stopRafScroll();
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    }
    return () => stopRafScroll();
  }, [isStreaming, startRafScroll, stopRafScroll]);

  useEffect(() => {
    if (initialMessage) hasAutoSentRef.current = false;
  }, [initialMessage]);

  useEffect(() => {
    if (initialMessage && !hasAutoSentRef.current && !isStreaming && messages.length === 0) {
      hasAutoSentRef.current = true;
      sendMessage(initialMessage);
    }
  }, [initialMessage, isStreaming, messages.length, sendMessage]);

  const streamingMessage = useMemo(() => {
    if (!isStreaming || !currentStreamContent) return null;
    return {
      id: 'streaming',
      content: currentStreamContent,
      role: 'assistant' as const,
      timestamp: '',
      intent: (currentStreamIntent ?? persistedIntent)?.intent || undefined,
    };
  }, [isStreaming, currentStreamContent, currentStreamIntent]);

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className={`chat-area ${isEmpty ? 'empty' : ''}`}>
      {isEmpty ? (
        <>
          <EmptyState />
          <div className="chat-input-container">
            <div className="chat-input-wrapper">
              <ChatInput
                initialValue={inputValue}
                onValueChange={setInputValue}
                placeholder={hoverPrompt || undefined}
              />
            </div>
          </div>
          <QuickActions onSelectAction={sendMessage} onHoverPrompt={setHoverPrompt} />
        </>
      ) : (
        <>
          {activeDiscussionId && currentDiscussion && (
            <ChatHeader
              discussionId={activeDiscussionId}
              discussionTitle={currentDiscussion.title}
            />
          )}

          <div className="chat-messages" ref={messagesContainerRef}>
            <div className="chat-messages-inner">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onRetry={() => handleRetry(message.id)}
                  onQuestionClick={handleQuestionClick}
                  onSend={sendMessage}
                  onHitlDecision={(fields, approved) => resolveHitl(fields, approved)}
                />
              ))}

              {isStreaming && !currentStreamContent && (
                <ThinkingIndicator />
              )}

              {streamingMessage && (
                <ChatMessage
                  message={streamingMessage}
                  isStreaming
                  onQuestionClick={handleQuestionClick}
                />
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {isSubmitted && (
            <div className="chat-input-container" style={{ paddingBottom: 0 }}>
              <div className="chat-input-wrapper">
                <div className="submit-success-banner">
                  <span className="submit-success-icon">✓</span>
                  <span>
                    Pipeline run started — watch the log below or{' '}
                    {activeTaskId ? (
                      <Link to={`/runs/${activeTaskId}`}>open run detail</Link>
                    ) : (
                      'wait for completion'
                    )}
                    . Review the PR on GitHub when ready.
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="chat-input-container">
            <div className="chat-input-wrapper">
              <ChatInput
                initialValue={inputValue}
                onValueChange={setInputValue}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface QuickActionsProps {
  onSelectAction: (prompt: string) => void;
  onHoverPrompt: (prompt: string) => void;
}

function QuickActions({ onSelectAction, onHoverPrompt }: QuickActionsProps) {
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeSubmenu = useCallback(() => {
    onHoverPrompt('');
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setOpenActionId(null);
      setIsClosing(false);
    }, 140);
  }, [onHoverPrompt]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSubmenu();
      }
    }
    if (openActionId) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openActionId, closeSubmenu]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const quickActionIcons = [Wrench, GitBranch, Layers, BookOpen];
  const quickActions = FACTORY_STARTERS.map((starter, index) => ({
    id: starter.main.toLowerCase().replace(/\s+/g, '-'),
    icon: quickActionIcons[index] ?? MessageCircle,
    label: starter.main,
    subPrompts: starter.subQuestions.map(q => q.text),
  }));

  const openAction = quickActions.find((a) => a.id === openActionId);

  return (
    <div className="quick-actions-container" ref={containerRef}>
      <div className="quick-actions">
        {quickActions.map((action) => (
          <button
            key={action.id}
            className={`quick-action-btn ${openActionId === action.id ? 'active' : ''}`}
            onClick={() => {
              if (openActionId === action.id) { closeSubmenu(); }
              else { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); setIsClosing(false); setOpenActionId(action.id); }
            }}
          >
            <action.icon size={16} />
            <span>{action.label}</span>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>

      {openAction && (
        <div className={`quick-actions-submenu ${isClosing ? 'closing' : ''}`}>
          <div className="quick-actions-submenu-header">
            <span>{openAction.label}</span>
            <button className="quick-actions-submenu-close" onClick={closeSubmenu}>
              <X size={14} />
            </button>
          </div>
          <div className="quick-actions-submenu-items" onMouseLeave={() => onHoverPrompt('')}>
            {openAction.subPrompts.map((prompt, i) => (
              <button
                key={i}
                className="quick-actions-submenu-item"
                onMouseEnter={() => onHoverPrompt(prompt)}
                onClick={() => { onSelectAction(prompt); closeSubmenu(); }}
              >
                <span>{prompt}</span>
                <ArrowUpRight size={14} className="quick-actions-submenu-arrow" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  const user = useAuthStore((s) => s.user);
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';
  const firstName = displayName.split(' ')[0];

  return (
    <div className="empty-state">
      {firstName && (
        <p className="empty-state-greeting">Hi {firstName},</p>
      )}
      <h1 className="empty-state-title">
        <RotatingText
          texts={[
            'Describe a scoped goal for your repo.',
            'Gantry runs the pipeline and opens a PR.',
          ]}
          interval={4500}
        />
      </h1>
    </div>
  );
}
