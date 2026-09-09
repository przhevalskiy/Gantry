import { useCallback, useEffect, useState } from 'react';

interface UseSpeechReturn {
  speak: (text: string, onEnd?: () => void) => void;
  cancel: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

/** Strip basic markdown so the spoken output sounds natural. */
function plainSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')      // code blocks
    .replace(/`([^`]+)`/g, '$1')           // inline code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links/images → label
    .replace(/[*_#>]/g, '')                // emphasis / headings / quotes
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Browser text-to-speech via the Web Speech SpeechSynthesis API.
 */
export function useSpeech(): UseSpeechReturn {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [isSpeaking, setIsSpeaking] = useState(false);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    const clean = plainSpeech(text || '');
    if (!isSupported || !clean) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => { setIsSpeaking(false); onEnd?.(); };
    utterance.onerror = () => { setIsSpeaking(false); onEnd?.(); };
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  // Stop any in-flight speech if the component using this unmounts.
  useEffect(() => {
    return () => {
      if (isSupported) window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  return { speak, cancel, isSpeaking, isSupported };
}
