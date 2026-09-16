'use client';
import { useEffect, useRef, useState } from 'react';
import type { UILanguage } from '@/lib/schema';
import { t } from '@/lib/i18n';
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useSpeech(language: UILanguage, onTranscript: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingEnabled, setSpeakingEnabled] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onTranscript);
  callback.current = onTranscript;
  useEffect(() => {
    const win = window as SpeechWindow;
    setSupported(!!(win.SpeechRecognition || win.webkitSpeechRecognition));
    try {
      setSpeakingEnabled(localStorage.getItem('fillflow:speech') === 'true');
    } catch {}
    return () => {
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);
  const lang =
    language === 'en'
      ? 'en-US'
      : language === 'es'
        ? 'es-ES'
        : language === 'ja'
          ? 'ja-JP'
          : 'zh-CN';
  const toggleSpeaking = () => {
    const next = !speakingEnabled;
    setSpeakingEnabled(next);
    try {
      localStorage.setItem('fillflow:speech', String(next));
    } catch {}
    if (!next) window.speechSynthesis?.cancel();
  };
  const speak = (text: string) => {
    if (!speakingEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };
  const toggleListening = () => {
    setError('');
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const win = window as SpeechWindow;
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Ctor) {
      setError(t(language, 'speechUnavailable'));
      return;
    }
    window.speechSynthesis?.cancel();
    const instance = new Ctor();
    recognition.current = instance;
    instance.lang = lang;
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      const text = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? '')
        .join(' ')
        .slice(0, 10000);
      callback.current(text);
    };
    instance.onerror = () => {
      setListening(false);
      setError(t(language, 'speechUnavailable'));
    };
    instance.onend = () => setListening(false);
    try {
      instance.start();
      setListening(true);
    } catch {
      setError(t(language, 'speechUnavailable'));
    }
  };
  const cancelListening = () => {
    if (recognition.current) {
      recognition.current.onresult = null;
      recognition.current.abort();
      recognition.current = null;
    }
    setListening(false);
  };
  return {
    cancelListening,
    supported,
    listening,
    speakingEnabled,
    toggleSpeaking,
    toggleListening,
    speak,
    error,
  };
}
