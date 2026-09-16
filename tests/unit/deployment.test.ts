import { afterEach, expect, test, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
vi.mock('@/lib/rate-limit', () => ({ enforceLimit: vi.fn() }));
vi.mock('@/lib/llm', () => ({ streamValidated: vi.fn() }));
import { POST as turn } from '@/app/api/turn/route';
import { POST as extract } from '@/app/api/extract/route';
import { streamValidated } from '@/lib/llm';
import { assertRequestFits } from '@/lib/deployment';
import { sample } from '../fixtures/form';
afterEach(() => vi.unstubAllEnvs());
test('preview rejects uploads and unknown schemas before making model calls', async () => {
  vi.stubEnv('NEXT_PUBLIC_DEMO_ONLY', 'true');
  expect(
    (await extract(new Request('http://localhost/api/extract', { method: 'POST' }))).status,
  ).toBe(503);
  expect(
    (
      await turn(
        new Request('http://localhost/api/turn', {
          method: 'POST',
          body: JSON.stringify({
            schema: sample,
            answers: {},
            currentFieldId: 'name',
            action: 'answer',
            input: 'Alex',
            uiLanguage: 'en',
          }),
        }),
      )
    ).status,
  ).toBe(503);
  expect(streamValidated).not.toHaveBeenCalled();
});
test('preview keeps original-language demo answers without any translation request', async () => {
  vi.stubEnv('NEXT_PUBLIC_DEMO_ONLY', 'true');
  const schema = JSON.parse(
    await readFile('public/demo-forms/change-of-address.schema.json', 'utf8'),
  );
  const response = await turn(
    new Request('http://localhost/api/turn', {
      method: 'POST',
      body: JSON.stringify({
        schema,
        answers: {},
        currentFieldId: 'f19',
        action: 'answer',
        input: '上海市',
        uiLanguage: 'zh-CN',
      }),
    }),
  );
  const result = JSON.parse((await response.text()).trim());
  expect(result.data.validation.ok).toBe(true);
  expect(result.data.nextFieldId).not.toBe('f19');
  expect(streamValidated).not.toHaveBeenCalled();
});
test('hosted request size accounts for all pages and multipart overhead', () => {
  vi.stubEnv('NEXT_PUBLIC_MAX_REQUEST_BYTES', '4400000');
  const data = new FormData();
  data.set('original', new File([new Uint8Array(3_000_000)], 'form.pdf'));
  expect(assertRequestFits(data)).toBe(true);
  data.append('pages[]', new File([new Uint8Array(1_500_000)], 'page.jpg'));
  expect(assertRequestFits(data)).toBe(false);
});
