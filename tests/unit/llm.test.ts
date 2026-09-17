import { afterEach, expect, test, vi } from 'vitest';
import { z } from 'zod';
vi.mock('ai', async (original) => ({
  ...(await original<typeof import('ai')>()),
  generateObject: vi.fn(),
}));
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => ({ chatModel: (model: string) => model })),
}));
import { generateObject, NoObjectGeneratedError } from 'ai';
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
test('repair receives the nested validation path instead of the generic SDK error', async () => {
  const schema = z.object({ rows: z.array(z.tuple([z.string(), z.number(), z.number()])) });
  const invalid = schema.safeParse({ rows: [['Name', 4]] });
  if (invalid.success) throw new Error('Expected invalid fixture');
  const error = new NoObjectGeneratedError({
    message: 'No object generated: response did not match schema.',
    text: '{"rows":[["Name",4]]}',
    cause: new Error('Type validation failed', { cause: invalid.error }),
    response: { id: 'test', modelId: 'test', timestamp: new Date() },
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    finishReason: 'stop',
  });
  vi.mocked(generateObject)
    .mockRejectedValueOnce(error)
    .mockResolvedValueOnce({ object: { rows: [['Name', 4, -1]] } } as never);
  await generateValidated(schema, [{ role: 'user', content: 'Extract this field' }]);
  const feedback = vi.mocked(generateObject).mock.calls[1][0].messages?.at(-1)?.content;
  expect(feedback).toContain('rows.0');
  expect(feedback).toContain('at least 3');
});
test('Doubao explicitly configures thinking without changing the JSON or image payload', () => {
  vi.stubEnv('LLM_PROVIDER', 'doubao');
  vi.stubEnv('ARK_API_KEY', 'test');
  vi.stubEnv('DOUBAO_MODEL', 'test-doubao');
  vi.stubEnv('DOUBAO_THINKING', 'disabled');
  getModel();
  const transform = vi.mocked(createOpenAICompatible).mock.lastCall?.[0]?.transformRequestBody;
  const body = {
    messages: [{ role: 'user', content: 'image and JSON request' }],
    response_format: { type: 'json_object' },
  };
  expect(transform?.(body)).toEqual({ ...body, thinking: { type: 'disabled' } });
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
