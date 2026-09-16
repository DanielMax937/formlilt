'use client';
import { track } from '@vercel/analytics';
export function event(
  name:
    | 'upload'
    | 'schema_ok'
    | 'first_answer'
    | 'completed'
    | 'download'
    | 'upload_rejected'
    | 'rate_limited',
) {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true' &&
    process.env.NEXT_PUBLIC_ENABLE_CUSTOM_EVENTS === 'true'
  )
    track(name);
}
