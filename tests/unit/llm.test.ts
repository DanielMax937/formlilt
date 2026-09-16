import { afterEach, expect, test, vi } from 'vitest';
import { z } from 'zod';
vi.mock('ai', async (original) => ({
  ...(await original<typeof import('ai')>()),
  generateObject: vi.fn(),
}));
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => ({ chatModel: (model: string) => model })),
}));
import { generateObject } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateValidated, getModel } from '@/lib/llm';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
test('provider switches route to the correct configured endpoint', () => {
  for (const provider of ['agent-im', 'openai', 'doubao']) {
    vi.stubEnv('LLM_PROVIDER', provider);
    vi.stubEnv('ARK_API_KEY', 'test');
    vi.stubEnv('DOUBAO_MODEL', 'test-doubao');
    vi.stubEnv('OPENAI_API_KEY', 'test');
    getModel();
    expect(vi.mocked(createOpenAICompatible).mock.lastCall?.[0]?.name).toBe(provider);
  }
});
test('one repair retry validates semantics without accepting invalid output', async () => {
  vi.mocked(generateObject)
    .mockResolvedValueOnce({ object: { name: 'bad' } } as never)
    .mockResolvedValueOnce({ object: { name: 'good' } } as never);
  const result = await generateValidated(
    z.object({ name: z.string() }),
    [{ role: 'user', content: 'test' }],
    (value) => {
      if (value.name === 'bad') throw new Error('Unsupported field label');
      return value;
    },
  );
  expect(result.name).toBe('good');
  expect(generateObject).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(vi.mocked(generateObject).mock.calls[1][0])).toContain(
    'Unsupported field label',
  );
});
test('upstream failures become safe readable errors', async () => {
  vi.mocked(generateObject).mockRejectedValueOnce(
    new Error('upstream unavailable with secret request'),
  );
  await expect(generateValidated(z.object({ name: z.string() }), [])).rejects.toMatchObject({
    status: 502,
    code: 'llm_error',
  });
});
test('converts legacy tuple schemas for agent-im validator', async () => {
  const { normalizeAgentSchema } = await import('@/lib/llm');
  expect(
    normalizeAgentSchema({
      $schema: 'draft-07',
      type: 'array',
      items: [{ type: 'number' }, { type: 'number' }],
    }),
  ).toEqual({ type: 'array', prefixItems: [{ type: 'number' }, { type: 'number' }], items: false });
});
