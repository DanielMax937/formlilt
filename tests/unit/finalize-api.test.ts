import { expect, test, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
vi.mock('@/lib/llm', () => ({
  generateValidated: vi.fn().mockRejectedValue(new Error('offline')),
}));
vi.mock('@/lib/rate-limit', () => ({ enforceLimit: vi.fn() }));
import { POST } from '@/app/api/finalize/route';
import { FormSchema } from '@/lib/schema';
import { fixtureAnswers } from '../fixtures/answers';
test('finalize returns a readable PDF, safe headers and deterministic demo summary without a model', async () => {
  const schema = FormSchema.parse(
    JSON.parse(await readFile('public/demo-forms/change-of-address.schema.json', 'utf8')),
  );
  const png =
    'data:image/png;base64,' + (await readFile('tests/fixtures/signature.png')).toString('base64');
  const data = new FormData();
  data.set(
    'original',
    new File([await readFile('public/demo-forms/change-of-address.pdf')], 'form.pdf', {
      type: 'application/pdf',
    }),
  );
  data.set(
    'payload',
    JSON.stringify({ schema, answers: fixtureAnswers(schema, png), uiLanguage: 'en', lock: false }),
  );
  const res = await POST(
    new Request('http://localhost/api/finalize', { method: 'POST', body: data }),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect(decodeURIComponent(res.headers.get('x-summary')!)).toContain('answers');
  expect((await PDFDocument.load(await res.arrayBuffer())).getPageCount()).toBe(2);
});
test('finalize rejects malformed/missing multipart input', async () => {
  expect(
    (
      await POST(
        new Request('http://localhost/api/finalize', { method: 'POST', body: new FormData() }),
      )
    ).status,
  ).toBe(400);
});

test('verified demos export without uploading the public original; mismatched slugs fail', async () => {
  const schema = FormSchema.parse(
    JSON.parse(await readFile('public/demo-forms/insurance-claim.schema.json', 'utf8')),
  );
  const png =
    'data:image/png;base64,' + (await readFile('tests/fixtures/signature.png')).toString('base64');
  const payload = {
    schema,
    answers: fixtureAnswers(schema, png),
    uiLanguage: 'en',
    demoSlug: 'insurance-claim',
  };
  const request = (value: unknown) => {
    const data = new FormData();
    data.set('payload', JSON.stringify(value));
    return new Request('http://localhost/api/finalize', { method: 'POST', body: data });
  };
  const response = await POST(request(payload));
  expect(response.status).toBe(200);
  expect((await PDFDocument.load(await response.arrayBuffer())).getPageCount()).toBe(2);
  expect((await POST(request({ ...payload, demoSlug: 'change-of-address' }))).status).toBe(400);
  expect(
    (await POST(request({ ...payload, schema: { ...schema, title: 'Tampered' } }))).status,
  ).toBe(400);
});
