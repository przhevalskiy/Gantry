import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Mic, MicOff } from 'lucide-react';
import { useChatStore } from '../../store';
import { useSSE } from '@/shared/hooks/useSSE';
import { useVoice } from '@/shared/hooks/useVoice';
import { useSpeech } from '@/shared/hooks/useSpeech';
import './VoiceMode.css';

type Status = 'listening' | 'thinking' | 'speaking' | 'paused';

interface VoiceModeProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_LABEL: Record<Status, string> = {
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  paused: 'Paused — tap to talk',
};

export function VoiceMode({ isOpen, onClose }: VoiceModeProps) {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const { sendMessage } = useSSE();
  const { speak, cancel: cancelSpeech, isSupported: ttsSupported } = useSpeech();

  const [status, setStatus] = useState<Status>('listening');
  const [caption, setCaption] = useState('');       // last user utterance
  const [reply, setReply] = useState('');           // last assistant reply
  const statusRef = useRef<Status>('listening');
  const prevStreamingRef = useRef(false);
  statusRef.current = status;

  const handleFinal = useCallback((text: string) => {
    if (statusRef.current !== 'listening' || !text.trim()) return;
    setCaption(text);
    setReply('');
    setStatus('thinking');
    sendMessage(text);
  }, [sendMessage]);

  const { isRecording, isSupported, transcript, startRecording, stopRecording, error } = useVoice(handleFinal);

  // Start/stop the mic with the overlay lifecycle.
  useEffect(() => {
    if (isOpen && isSupported) {
      setStatus('listening');
      startRecording();
    }
    return () => {
      stopRecording();
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // When the assistant finishes streaming, speak the reply then resume listening.
  useEffect(() => {
    const justFinished = prevStreamingRef.current && !isStreaming;
    prevStreamingRef.current = isStreaming;
    if (!justFinished || statusRef.current !== 'thinking') return;

    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    const text = lastAssistant?.content?.trim() || '';
    setReply(text || 'Please review the details on your screen.');

    setStatus('speaking');
    const resume = () => {
      if (statusRef.current === 'speaking') {
        setStatus('listening');
        startRecording();
      }
    };
    if (text && ttsSupported) {
      speak(text, resume);
    } else {
      // Nothing to read aloud (e.g. a tool/checklist turn) — resume promptly.
      setTimeout(resume, 800);
    }
  }, [isStreaming, messages, speak, startRecording, ttsSupported]);

  const handleOrbClick = () => {
    if (status === 'speaking') {
      // Barge-in: stop talking and listen.
      cancelSpeech();
      setStatus('listening');
      startRecording();
    } else if (status === 'listening') {
      stopRecording();
      setStatus('paused');
    } else if (status === 'paused') {
      setStatus('listening');
      startRecording();
    }
  };

  const handleClose = () => {
    stopRecording();
    cancelSpeech();
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="voice-mode-overlay">
      <button className="voice-mode-close" onClick={handleClose} title="Exit voice mode">
        <X size={22} />
      </button>

      <div className={`voice-orb voice-orb-${status}`} onClick={handleOrbClick} role="button" tabIndex={0}>
        <div className="voice-orb-core">
          {status === 'paused' ? <MicOff size={32} /> : <Mic size={32} />}
        </div>
        {(status === 'listening' || status === 'speaking') && (
          <>
            <span className="voice-orb-ring" />
            <span className="voice-orb-ring voice-orb-ring-2" />
          </>
        )}
      </div>

      <p className="voice-mode-status">{STATUS_LABEL[status]}</p>

      {!isSupported && (
        <p className="voice-mode-error">Voice input isn’t supported in this browser. Try Chrome, Edge, or Safari.</p>
      )}
      {error && <p className="voice-mode-error">{error}</p>}

      <div className="voice-mode-captions">
        {status === 'listening' && transcript && (
          <p className="voice-caption-interim">{transcript}</p>
        )}
        {caption && <p className="voice-caption-user">“{caption}”</p>}
        {reply && <p className="voice-caption-reply">{reply}</p>}
      </div>

      <p className="voice-mode-hint">
        {isRecording ? 'Speak naturally — I’ll respond when you pause.' : 'Tap the mic to talk.'}
      </p>
    </div>,
    document.body
  );
}
