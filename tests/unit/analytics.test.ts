import { expect, test, vi, afterEach } from 'vitest';
import { privateAnalyticsEvent } from '@/lib/analytics-privacy';
vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));
import { track } from '@vercel/analytics';
import { event } from '@/lib/analytics';
afterEach(() => vi.unstubAllEnvs());
test('analytics URLs omit answers, fragments and session IDs', () => {
  expect(
    privateAnalyticsEvent({
      type: 'event',
      url: 'https://example.com/review/private-session?name=Alex#signature',
    })?.url,
  ).toBe('https://example.com/review/session');
});
test('five required product events carry no custom payload', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_ENABLE_ANALYTICS', 'true');
  for (const name of ['upload', 'schema_ok', 'first_answer', 'completed', 'download'] as const)
    event(name);
  expect(vi.mocked(track).mock.calls).toEqual([
    ['upload'],
    ['schema_ok'],
    ['first_answer'],
    ['completed'],
    ['download'],
  ]);
});
