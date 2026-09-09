import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Square, AudioLines } from 'lucide-react';
import { useSSE } from '@/shared/hooks/useSSE';
import { useChatStore } from '@/features/chat';
import { useDiscussionStore } from '@/features/discussions';
import { InputActionsDropdown } from '../input/InputActionsDropdown';
import { VoiceMode } from '../voice/VoiceMode';
import { PromptWizardModal, detectWizardIntent } from '../modals/PromptWizardModal';
import { GANTRY_PLATFORM } from '@/shared/services/gantry/config';
import './ChatInput.css';

interface ChatInputProps {
  initialValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
}

export function ChatInput({ initialValue = '', onValueChange, placeholder }: ChatInputProps) {
  const hoverPlaceholder = useChatStore((s) => s.hoverPlaceholder);
  const navigate = useNavigate();
  const [input, setInput] = useState(initialValue);
  const [wizardIntent, setWizardIntent] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState('');
  const [showVoiceMode, setShowVoiceMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, stopStream, isStreaming } = useSSE();
  const { activeDiscussionId, createDiscussion } = useDiscussionStore();
  const { skipNextMessageLoad } = useChatStore();

  useEffect(() => {
    if (initialValue !== input) setInput(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleInputChange = (value: string) => {
    setInput(value);
    onValueChange?.(value);
  };

  const doSend = async (message: string) => {
    let discussionId = activeDiscussionId;
    if (!discussionId) {
      const newDiscussion = await createDiscussion();
      discussionId = newDiscussion.id;
      skipNextMessageLoad();
      navigate(`/chat/${discussionId}`);
    }

    setInput('');
    onValueChange?.('');

    try {
      await sendMessage(message, discussionId);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = (error as Error).message || '';
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        try {
          const newDiscussion = await createDiscussion();
          navigate(`/chat/${newDiscussion.id}`);
          await sendMessage(message, newDiscussion.id);
        } catch (retryError) {
          console.error('Failed to recover:', retryError);
          setInput(message);
          onValueChange?.(message);
        }
      } else {
        setInput(message);
        onValueChange?.(message);
      }
    }
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const message = input.trim();
    if (!message || isStreaming) return;

    const intent = GANTRY_PLATFORM ? null : detectWizardIntent(message);
    if (intent && intent !== 'media') {
      setPendingMessage(message);
      setWizardIntent(intent);
      return;
    }

    await doSend(message);
  };

  const handleWizardComplete = async (enriched: string) => {
    setWizardIntent(null);
    await doSend(enriched);
  };

  const handleWizardDismiss = () => {
    setWizardIntent(null);
    setInput(pendingMessage);
    onValueChange?.(pendingMessage);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-input">
      <PromptWizardModal
        isOpen={!!wizardIntent}
        intent={wizardIntent || ''}
        originalMessage={pendingMessage}
        onComplete={handleWizardComplete}
        onDismiss={handleWizardDismiss}
      />

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <div className="chat-input-box">
          <InputActionsDropdown />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hoverPlaceholder || placeholder || 'Describe a fix, feature, or refactor…'}
            disabled={isStreaming}
            rows={1}
            className="chat-textarea"
          />

          <button
            type="button"
            className="input-action-btn"
            onClick={() => setShowVoiceMode(true)}
            disabled={isStreaming}
            title="Voice mode — talk hands-free"
          >
            <AudioLines size={20} />
          </button>

          {isStreaming ? (
            <button type="button" className="send-btn stop" onClick={stopStream} title="Stop generating">
              <Square size={16} />
            </button>
          ) : (
            <button type="submit" className="send-btn" disabled={!input.trim()} title="Send message">
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </form>

      <p className="chat-input-hint">
        Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line
      </p>

      <VoiceMode isOpen={showVoiceMode} onClose={() => setShowVoiceMode(false)} />
    </div>
  );
}
