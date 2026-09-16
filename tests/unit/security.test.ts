import { expect, test } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { parseDocument } from '@/lib/pdf-extract';
import { limitedBody } from '@/lib/errors';
import { FormSchema } from '@/lib/schema';
import { isKnownDemo } from '@/lib/known-demo';
import { sample } from '../fixtures/form';
test('rejects forged formats, too many pages and PNG decompression dimensions before decoding', async () => {
  await expect(parseDocument(new TextEncoder().encode('<script>fake.pdf'))).rejects.toThrow();
  const doc = await PDFDocument.create();
  for (let i = 0; i < 16; i++) doc.addPage();
  await expect(parseDocument(await doc.save())).rejects.toThrow('15 pages');
  const png = new Uint8Array(await readFile('tests/fixtures/signature.png'));
  new DataView(png.buffer).setUint32(16, 1000000);
  await expect(parseDocument(png)).rejects.toThrow('dimensions');
});
test('rejects excess streamed body and reserved field identifiers', async () => {
  await expect(
    limitedBody(new Request('http://localhost', { method: 'POST', body: '123456789' }), 4),
  ).rejects.toMatchObject({ status: 400 });
  expect(
    FormSchema.safeParse({ ...sample, fields: [{ ...sample.fields[0], id: '__proto__' }] }).success,
  ).toBe(false);
});
test('unlimited demo calls require the exact public schema', async () => {
  const schema = FormSchema.parse(
    JSON.parse(await readFile('public/demo-forms/insurance-claim.schema.json', 'utf8')),
  );
  expect(await isKnownDemo(schema)).toBe(true);
  expect(await isKnownDemo({ ...schema, title: 'Forged form' })).toBe(false);
});
