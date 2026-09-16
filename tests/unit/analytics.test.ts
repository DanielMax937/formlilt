import { expect, test, vi, afterEach } from 'vitest';
import { privateAnalyticsEvent } from '@/lib/analytics-privacy';
vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));
import { track } from '@vercel/analytics';
import { event, errorEvent } from '@/lib/analytics';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
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
  vi.stubEnv('NEXT_PUBLIC_ENABLE_CUSTOM_EVENTS', 'true');
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

test('Hobby page views can be enabled without sending paid custom events', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_ENABLE_ANALYTICS', 'true');
  vi.stubEnv('NEXT_PUBLIC_ENABLE_CUSTOM_EVENTS', 'false');
  event('completed');
  errorEvent('llm_error');
  expect(track).not.toHaveBeenCalled();
});

test('failure events preserve the server category and never accept messages or arbitrary codes', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_ENABLE_ANALYTICS', 'true');
  vi.stubEnv('NEXT_PUBLIC_ENABLE_CUSTOM_EVENTS', 'true');
  const codes = [
    'upload_rejected',
    'rate_limited',
    'llm_error',
    'llm_schema_fail',
    'llm_blocked',
    'schema_empty',
    'finalize_error',
  ];
  for (const code of codes) errorEvent(code);
  errorEvent('Private document title: Alex Rivera');
  errorEvent({ code: 'llm_error', message: 'Private answer' });
  errorEvent(undefined);
  expect(vi.mocked(track).mock.calls).toEqual(codes.map((code) => [code]));
});
