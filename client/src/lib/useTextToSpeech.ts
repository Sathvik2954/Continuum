import { useState, useCallback, useEffect } from 'react';

interface UseTTSReturn {
  speak: (text: string, lang?: string) => void;
  stop: () => void;
  speaking: boolean;
  supported: boolean;
}

// Maps app language codes to BCP-47 speech synthesis language tags
const LANG_MAP: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
};

export function useTextToSpeech(): UseTTSReturn {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported('speechSynthesis' in window);
  }, []);

  const speak = useCallback((text: string, lang = 'en'): void => {
    if (!supported || !text) return;

    // Cancel any in-progress speech before starting new
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_MAP[lang] || 'en-IN';
    utterance.rate = 0.9; // slightly slower - clearer for medication instructions
    utterance.pitch = 1;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [supported]);

  const stop = useCallback((): void => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, supported };
}
