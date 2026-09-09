import { AudioLines } from 'lucide-react';
import { useVoice } from '@/shared/hooks/useVoice';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const { isRecording, isSupported, startRecording, stopRecording, error } = useVoice(onTranscript);

  if (!isSupported) return null;

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`input-action-btn${isRecording ? ' recording' : ''}`}
        title={isRecording ? 'Stop recording' : 'Voice input'}
      >
        <AudioLines size={20} />
      </button>

      {isRecording && (
        <div className="voice-listening-indicator">
          <span className="voice-listening-dot" />
          Listening...
        </div>
      )}

      {error && (
        <div className="voice-error-indicator">{error}</div>
      )}
    </div>
  );
}
