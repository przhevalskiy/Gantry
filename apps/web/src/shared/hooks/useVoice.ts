import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVoiceReturn {
  isRecording: boolean;
  isSupported: boolean;
  transcript: string;
  startRecording: () => void;
  stopRecording: () => void;
  error: string | null;
}

function getSpeechRecognition(): any {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Browser speech-to-text via the Web Speech API.
 * `onFinalTranscript` fires once per completed utterance; `transcript` holds
 * the live interim text for display. Supported in Chrome/Edge/Safari.
 */
export function useVoice(onFinalTranscript?: (text: string) => void): UseVoiceReturn {
  const SR = getSpeechRecognition();
  const isSupported = !!SR;

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const callbackRef = useRef(onFinalTranscript);
  callbackRef.current = onFinalTranscript;

  const stopRecording = useCallback(() => {
    const r = recognitionRef.current;
    if (r) {
      try { r.stop(); } catch { /* ignore */ }
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    if (!isSupported) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    setError(null);

    // Tear down any previous instance.
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }

    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final.trim()) {
        setTranscript('');
        callbackRef.current?.(final.trim());
      } else {
        setTranscript(interim);
      }
    };

    recognition.onerror = (e: any) => {
      // no-speech / aborted are normal lifecycle events, not user-facing errors.
      if (e.error && e.error !== 'no-speech' && e.error !== 'aborted') {
        setError(e.error === 'not-allowed' ? 'Microphone permission denied.' : e.error);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      // start() throws if already started — ignore.
    }
  }, [isSupported, SR]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
    };
  }, []);

  return { isRecording, isSupported, transcript, startRecording, stopRecording, error };
}
