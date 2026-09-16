'use client';
import { track } from '@vercel/analytics';
import { z } from 'zod';
const FailureEvent = z.enum([
  'upload_rejected',
  'rate_limited',
  'llm_error',
  'llm_schema_fail',
  'llm_blocked',
  'schema_empty',
  'finalize_error',
]);
// Accept only fixed event names. API messages can contain document details.
export function errorEvent(code: unknown) {
  const parsed = FailureEvent.safeParse(code);
  if (parsed.success) event(parsed.data);
}
export function event(
  name:
    | 'upload'
    | 'schema_ok'
    | 'first_answer'
    | 'completed'
    | 'download'
    | z.infer<typeof FailureEvent>,
) {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true' &&
    process.env.NEXT_PUBLIC_ENABLE_CUSTOM_EVENTS === 'true'
  )
    track(name);
}
