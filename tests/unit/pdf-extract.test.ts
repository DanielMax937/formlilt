import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { parseDocument } from '@/lib/pdf-extract';
import { fileKind, fittedSize } from '@/lib/files';
for (const slug of ['change-of-address', 'insurance-claim', 'medical-release'])
  test(`extracts real ${slug} PDF text and widgets`, async () => {
    const result = await parseDocument(
      new Uint8Array(await readFile(`public/demo-forms/${slug}.pdf`)),
    );
    expect(result.pages.length).toBeGreaterThanOrEqual(2);
    expect(result.pages.length).toBeLessThanOrEqual(4);
    expect(result.pages.every((p) => p.kind === 'text')).toBe(true);
    if (slug === 'change-of-address') expect(result.acroFields.length).toBeGreaterThan(10);
    console.info(
      slug,
      JSON.stringify({
        pages: result.pages.map((p) => ({ items: p.textItems.length, kind: p.kind })),
        acro: result.acroFields.length,
      }),
    );
  });
test('photos use scan path; invalid bytes are rejected', async () => {
  const result = await parseDocument(new Uint8Array(await readFile('tests/fixtures/photo.jpg')));
  expect(result.source).toBe('image');
  expect(result.pages[0].kind).toBe('scan');
  expect(result.pages[0].textItems).toEqual([]);
  await expect(parseDocument(new Uint8Array([1, 2, 3]))).rejects.toThrow('PDF');
  expect(fileKind(new TextEncoder().encode('<script>'))).toBe(null);
});
test('rendered page dimensions stay within 1600 px', () => {
  expect(fittedSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  expect(fittedSize(600, 1000)).toEqual({ width: 600, height: 1000 });
});
