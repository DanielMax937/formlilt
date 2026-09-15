import { expect, test } from 'vitest';
import { Env } from '@/lib/env';
test('defaults to agent-im and rejects invalid configuration', () => {
  expect(Env.parse({}).LLM_PROVIDER).toBe('agent-im');
  expect(Env.safeParse({ AGENT_IM_BASE_URL: 'not-a-url' }).success).toBe(false);
  expect(Env.safeParse({ RATE_LIMIT_EXTRACT_PER_DAY: '0' }).success).toBe(false);
});
