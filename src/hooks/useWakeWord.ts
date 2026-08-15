import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWakeWordOptions {
  enabled?: boolean;
  onWakeDetected?: () => void;
  onStopDetected?: () => void;
  wakeWords?: string[];
  stopWords?: string[];
}

export function useWakeWord(options: UseWakeWordOptions = {}) {
  const {
    enabled = true,
    onWakeDetected,
    onStopDetected,
    wakeWords = ['джарвис', 'jarvis', 'жарвис', 'эй джарвис', 'слушай джарвис'],
    stopWords = ['стоп', 'стопнули', 'хватит', 'отмена'],
  } = options;

  const [isListeningForWake, setIsListeningForWake] = useState(false);
  const [lastDetectedPhrase, setLastDetectedPhrase] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isEnabledRef = useRef(enabled);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  isEnabledRef.current = enabled;

  const startListening = useCallback(() => {
    if (!isEnabledRef.current) return;

    const SpeechRecClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecClass) {
      // Web Speech API not supported in this browser environment
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ru-RU';

      recognition.onstart = () => {
        setIsListeningForWake(true);
      };

      recognition.onresult = (event: any) => {
        const lastIdx = event.results.length - 1;
        const result = event.results[lastIdx];
        if (!result) return;

        const transcript = result[0]?.transcript?.trim()?.toLowerCase() || '';
        if (!transcript) return;

        setLastDetectedPhrase(transcript);

        // Check for wake words
        const isWake = wakeWords.some((w) => transcript.includes(w));
        if (isWake) {
          onWakeDetected?.();
          return;
        }

        // Check for stop words
        const isStop = stopWords.some((s) => transcript.includes(s));
        if (isStop) {
          onStopDetected?.();
          return;
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'no-speech' || e.error === 'network') {
          // Normal timeout or background pause
        }
      };

      recognition.onend = () => {
        setIsListeningForWake(false);
        // Auto-restart continuous listening loop if still enabled
        if (isEnabledRef.current) {
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = setTimeout(() => {
            if (isEnabledRef.current) {
              startListening();
            }
          }, 1000);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      // Speech recognition start error fallback
    }
  }, [onStopDetected, onWakeDetected, stopWords, wakeWords]);

  const stopListening = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListeningForWake(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }

    return () => {
      stopListening();
    };
  }, [enabled, startListening, stopListening]);

  return {
    isListeningForWake,
    lastDetectedPhrase,
    startListening,
    stopListening,
  };
}
