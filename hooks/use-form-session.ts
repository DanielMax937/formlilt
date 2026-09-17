'use client';
import { isDemoOnly } from '@/lib/deployment';
import { useEffect, useRef, useState } from 'react';
import { Session, TurnResult, type UILanguage } from '@/lib/schema';
import { loadSession, saveSession } from '@/lib/storage';
import { applyAnswer, nextField } from '@/lib/next-field';
import { attachSignature } from '@/lib/signature';
import { isSkipIntent, needsTranslation, validate } from '@/lib/validate';
import { errorText, t } from '@/lib/i18n';
import { event, errorEvent } from '@/lib/analytics';
import { readTurnStream } from '@/lib/turn-stream';
export function useFormSession(id: string, language: UILanguage, reviewMode = false) {
  const [session, setSession] = useState<Session | null>();
  const sessionRef = useRef<Session | null>(null);
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [translation, setTranslation] = useState<{ original: string; value: string } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const value = loadSession(id);
    setSession(value);
    sessionRef.current = value;
    return () => requestRef.current?.abort();
  }, [id]);
  const persist = (value: Session) => {
    try {
      saveSession(value);
      setSession(value);
      sessionRef.current = value;
      return true;
    } catch {
      setError(t(language, 'storage_error'));
      return false;
    }
  };
  const action = async (
    kind: 'answer' | 'skip' | 'back' | 'jump' | 'explain',
    value = '',
    target?: string,
    confirmed = false,
    normalizedFrom?: string,
    signedBy?: string,
  ) => {
    const before = sessionRef.current;
    if (!before?.currentFieldId) return false;
    const field = before.schema.fields.find((f) => f.id === before.currentFieldId);
    if (!field) return false;
    if (kind === 'answer' && isSkipIntent(value)) kind = 'skip';
    setError('');
    setQuestion('');
    if (kind !== 'explain') setExplanation('');
    if (kind === 'answer') {
      const result = validate(field, value, before.answers, signedBy);
      if (!result.ok) {
        setError(t(language, result.code!));
        return false;
      }
      value = result.value ?? value;
    }
    const needsConfirm =
      !isDemoOnly() &&
      kind === 'answer' &&
      !confirmed &&
      needsTranslation(field, value, language, before.schema.language);
    let answers =
      kind === 'answer' || kind === 'skip'
        ? applyAnswer(
            before.schema,
            before.answers,
            field.id,
            kind === 'skip' ? '' : value,
            kind === 'skip' ? 'skipped' : 'answered',
          )
        : before.answers;
    if (normalizedFrom && answers[field.id])
      answers = { ...answers, [field.id]: { ...answers[field.id], normalizedFrom } };
    if (kind === 'answer') answers = attachSignature(before.schema, answers, field, signedBy);
    let next: string | null;
    try {
      next = nextField(before.schema, answers, field.id, kind, target);
    } catch {
      return false;
    }
    const updated: Session = {
      ...before,
      answers,
      currentFieldId: next,
      uiLanguage: language,
      state: reviewMode || next === null ? 'reviewing' : 'asking',
    };
    if (!needsConfirm && kind !== 'explain') {
      if (!persist(updated)) return false;
      if (kind === 'answer' && Object.values(before.answers).every((a) => a.status !== 'answered'))
        event('first_answer');
    }
    if (kind === 'explain') setExplanation(field.help || t(language, 'unknownHelp'));
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(needsConfirm);
    const consume = (result: TurnResult) => {
      if (requestRef.current !== controller) return;
      if (!result.validation.ok) {
        persist(before);
        setError(result.validation.message || t(language, 'error'));
        return;
      }
      if (needsConfirm) {
        const normalized = result.validation.normalizedValue;
        if (normalized !== undefined && normalized !== value)
          setTranslation({ original: value, value: normalized });
        else persist(updated);
      }
      if (kind === 'explain')
        setExplanation(result.explanation || field.help || t(language, 'unknownHelp'));
      if (result.question && kind === 'explain') setQuestion(result.question);
    };
    try {
      const response = await fetch('/api/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]),
        body: JSON.stringify({
          schema: before.schema,
          answers: before.answers,
          currentFieldId: field.id,
          action: kind,
          input: value,
          targetFieldId: target,
          uiLanguage: language,
          confirmed,
          signedBy,
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        errorEvent(result.error?.code);
        throw new Error(errorText(language, result.error?.code, result.error?.message));
      }
      if (response.headers.get('content-type')?.includes('application/json'))
        consume(TurnResult.parse(await response.json()));
      else {
        for await (const item of readTurnStream(response.body!)) {
          if (item.type === 'result') consume(TurnResult.parse(item.data));
          if (item.type === 'error') {
            errorEvent(item.error?.code);
            throw new Error(errorText(language, item.error?.code, item.error?.message));
          }
          if (
            item.type === 'wording' &&
            kind === 'explain' &&
            typeof item.data?.explanation === 'string'
          )
            setExplanation(item.data.explanation.slice(0, 1500));
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        const incomplete =
          e instanceof Error &&
          (e.name === 'TimeoutError' || e.message === 'Incomplete form response');
        setError(
          incomplete
            ? t(language, 'llm_error')
            : e instanceof Error
              ? e.message
              : t(language, 'error'),
        );
      }
    } finally {
      if (requestRef.current === controller) setBusy(false);
    }
    return true;
  };
  return {
    session,
    error,
    explanation,
    question,
    busy,
    translation,
    action,
    persist,
    clearTranslation: () => setTranslation(null),
  };
}
