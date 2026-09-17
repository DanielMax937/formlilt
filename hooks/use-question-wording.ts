'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Session, UILanguage } from '@/lib/schema';
const Questions = z
  .record(z.string().max(100), z.string().max(1000))
  .refine((value) => Object.keys(value).length <= 150);
export function useQuestionWording(session: Session | null | undefined, language: UILanguage) {
  const [question, setQuestion] = useState('');
  useEffect(() => {
    setQuestion('');
    if (
      !session?.currentFieldId ||
      language.split('-')[0] === session.schema.language.toLowerCase().split('-')[0]
    )
      return;
    const controller = new AbortController();
    const fieldId = session.currentFieldId;
    const cacheKey = `fillflow:questions:${session.id}:${language}`;
    let cached: Record<string, string> = {};
    try {
      cached = Questions.parse(JSON.parse(localStorage.getItem(cacheKey) || '{}'));
    } catch {}
    if (cached[fieldId]) {
      setQuestion(cached[fieldId]);
      return;
    }
    const save = (questions: Record<string, string>) => {
      if (controller.signal.aborted) return;
      const next = Questions.parse({ ...cached, ...questions });
      if (next[fieldId]) setQuestion(next[fieldId]);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(next));
      } catch {}
    };
    const load = async () => {
      if (session.demoSlug) {
        const response = await fetch(`/demo-forms/${session.demoSlug}.questions.json`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const all = z.record(z.string(), Questions).parse(await response.json());
        if (all[language]) save(all[language]);
        return;
      }
      const response = await fetch('/api/turn', {
        method: 'POST',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: session.schema,
          answers: session.answers,
          currentFieldId: fieldId,
          action: 'explain',
          questionOnly: true,
          uiLanguage: language,
        }),
      });
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        buffer += decoder.decode(item.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line) continue;
          const event = z
            .object({
              type: z.string(),
              data: z
                .object({
                  question: z.string().max(1000).optional(),
                  translated: z.boolean().optional(),
                })
                .optional(),
            })
            .safeParse(JSON.parse(line));
          if (
            event.success &&
            event.data.type === 'result' &&
            event.data.data?.translated &&
            event.data.data.question
          )
            save({ [fieldId]: event.data.data.question });
        }
      }
    };
    void load().catch(() => {});
    return () => controller.abort();
  }, [session?.id, session?.currentFieldId, language]);
  return question;
}
