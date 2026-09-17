import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createHash } from 'node:crypto';
import { getEnv } from './env';
import { fail } from './errors';
const memory = new Map<string, number[]>();
export function memoryLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  if (memory.size > 10000)
    for (const [k, v] of memory) if (!v.some((t) => t > now - 86400000)) memory.delete(k);
  if (memory.size > 10000 && !memory.has(key)) return false;
  const valid = (memory.get(key) ?? []).filter((t) => t > now - windowMs);
  if (valid.length >= limit) {
    memory.set(key, valid);
    return false;
  }
  memory.set(key, [...valid, now]);
  return true;
}
export async function enforceLimit(request: Request, bucket: 'extract' | 'turn' | 'finalize') {
  const env = getEnv();
  const ip = process.env.VERCEL
    ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    : 'local';
  const key = createHash('sha256').update(`${bucket}:${ip}`).digest('hex');
  const limit =
    bucket === 'extract' ? env.RATE_LIMIT_EXTRACT_PER_DAY : bucket === 'turn' ? 120 : 30;
  const hours = bucket === 'extract' ? 24 : 1;
  let success: boolean;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });
      success = (
        await new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(limit, `${hours} h`),
          prefix: `fillflow:${bucket}`,
          analytics: false,
        }).limit(key)
      ).success;
    } catch {
      return fail(
        503,
        'rate_limit_unavailable',
        'Uploads are temporarily unavailable. Please try a demo.',
      );
    }
  } else {
    if (process.env.VERCEL && env.RATE_LIMIT_MODE !== 'memory')
      return fail(
        503,
        'rate_limit_unavailable',
        'Uploads are temporarily unavailable. Please try a demo.',
      );
    success = memoryLimit(key, limit, hours * 3600000);
  }
  if (!success)
    fail(
      429,
      'rate_limited',
      bucket === 'extract'
        ? 'The upload limit has been reached. Try again later, or use an unlimited demo.'
        : 'Please wait before trying again.',
    );
}
