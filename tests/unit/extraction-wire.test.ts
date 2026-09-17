import { readFile } from 'node:fs/promises';
import { afterEach, expect, test, vi } from 'vitest';
vi.mock('@/lib/llm', () => ({ generateValidated: vi.fn() }));
import { generateValidated } from '@/lib/llm';
import { extractForm } from '@/lib/extract-form';
import { ObjectExtract } from '@/lib/object-extract';
import { CompactExtract } from '@/lib/compact-extract';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
test.each([
  ['doubao', false],
  ['agent-im', false],
  ['openai', false],
  ['doubao', true],
] as const)(
  '%s extraction validates its wire format (native PDF: %s)',
  async (provider, native) => {
    vi.stubEnv('LLM_PROVIDER', provider);
    const wire = {
      title: 'Blank scan',
      language: 'en',
      sections: ['Applicant'],
      signature: -1,
      date: -1,
      name: -1,
      rows:
        provider === 'doubao' && !native
          ? [{ l: 'Name', t: 'text', r: true, p: 0, x: -1, b: [0.1, 0.1, 0.9, 0.3] }]
          : [
              [
                'Name',
                'text',
                true,
                0,
                0,
                native ? 0 : -1,
                -1,
                [0.1, 0.1, 0.9, 0.3],
                [],
                -1,
                '',
                [],
                null,
              ],
            ],
    };
    vi.mocked(generateValidated).mockImplementation(
      async (schema, _messages, verify = (value) => value) => verify(schema.parse(wire)),
    );
    const image = new Uint8Array(await readFile('tests/fixtures/photo.jpg'));
    const original = native
      ? new Uint8Array(await readFile('public/demo-forms/insurance-claim.pdf'))
      : image;
    const result = await extractForm(original, native ? [image, image] : [image]);
    expect(generateValidated).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateValidated).mock.lastCall?.[0]).toBe(
      provider === 'doubao' && !native ? ObjectExtract : CompactExtract,
    );
    expect(result.fields[0]).toMatchObject({
      label: 'Name',
      type: 'text',
      required: true,
      anchor: { page: 0 },
    });
  },
);
