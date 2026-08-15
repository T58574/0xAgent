import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWakeWordOptions {
  enabled?: boolean;
  isRecordingActive?: boolean;
  isSpeaking?: boolean;
  onWakeDetected?: () => void;
  onStopDetected?: () => void;
  wakeWords?: string[];
  stopWords?: string[];
}

export function useWakeWord(options: UseWakeWordOptions = {}) {
  const {
    enabled = false,
    isRecordingActive = false,
    isSpeaking = false,
    onWakeDetected,
    onStopDetected,
    wakeWords = ['джарвис', 'jarvis', 'жарвис'],
    stopWords = ['стоп', 'стопнули', 'хватит', 'отмена'],
  } = options;

  const [isListeningForWake, setIsListeningForWake] = useState(false);
  const [lastDetectedPhrase, setLastDetectedPhrase] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isRunningRef = useRef(false);
  const lastWakeTimeRef = useRef<number>(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const shouldBeRunning = enabled && !isRecordingActive && !isSpeaking;

  const stopListening = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    isRunningRef.current = false;
    setIsListeningForWake(false);
  }, []);

  const startListening = useCallback(() => {
    if (!shouldBeRunning || isRunningRef.current) return;

    const SpeechRecClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecClass) {
      return;
    }

    try {
      stopListening();

      const recognition = new SpeechRecClass();
      recognition.continuous = true;
      recognition.interimResults = false; // ONLY final results to eliminate 60fps micro-firing!
      recognition.lang = 'ru-RU';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isRunningRef.current = true;
        setIsListeningForWake(true);
      };

      recognition.onresult = (event: any) => {
        const now = Date.now();
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result) continue;

          const transcript = (result[0]?.transcript || '').trim().toLowerCase();
          if (!transcript) continue;

          setLastDetectedPhrase(transcript);

          // Check wake words with 6-second cooldown to prevent infinite re-trigger loops
          const isWake = wakeWords.some((w) => transcript.includes(w));
          if (isWake) {
            if (now - lastWakeTimeRef.current > 6000) {
              lastWakeTimeRef.current = now;
              // Stop speech recognition immediately before launching recorder
              stopListening();
              onWakeDetected?.();
              return;
            }
          }

          // Check stop words
          const isStop = stopWords.some((s) => transcript.includes(s));
          if (isStop) {
            onStopDetected?.();
            return;
          }
        }
      };

      recognition.onerror = (e: any) => {
        // Suppress benign errors
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        isRunningRef.current = false;
        setIsListeningForWake(false);
      };

      recognition.onend = () => {
        isRunningRef.current = false;
        setIsListeningForWake(false);

        // Restart only after a calm 3-second delay if still in active state
        if (shouldBeRunning) {
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            if (shouldBeRunning) {
              startListening();
            }
          }, 3000);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      isRunningRef.current = false;
      setIsListeningForWake(false);
    }
  }, [onStopDetected, onWakeDetected, shouldBeRunning, stopListening, stopWords, wakeWords]);

  useEffect(() => {
    if (shouldBeRunning) {
      startListening();
    } else {
      stopListening();
    }

    return () => {
      stopListening();
    };
  }, [shouldBeRunning, startListening, stopListening]);

  return {
    isListeningForWake,
    lastDetectedPhrase,
    startListening,
    stopListening,
  };
}
