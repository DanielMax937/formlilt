import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { AnnotationFlags, PDFDocument } from 'pdf-lib';
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

test('ignores unfillable native widgets and retains visible text and radio options', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const form = doc.getForm();
  for (const name of ['visible', 'readonly', 'zero-width', 'zero-height', 'hidden', 'no-view']) {
    const field = form.createTextField(name);
    field.addToPage(page, { x: 40, y: 600, width: 100, height: 20 });
    const widget = field.acroField.getWidgets()[0];
    if (name === 'readonly') field.enableReadOnly();
    if (name === 'zero-width') widget.setRectangle({ x: 40, y: 600, width: 0, height: 20 });
    if (name === 'zero-height') widget.setRectangle({ x: 40, y: 600, width: 100, height: 0 });
    if (name === 'hidden') widget.setFlag(AnnotationFlags.Hidden);
    if (name === 'no-view') widget.setFlag(AnnotationFlags.NoView);
  }
  const radio = form.createRadioGroup('choice');
  radio.addOptionToPage('Yes', page, { x: 40, y: 500, width: 15, height: 15 });
  radio.addOptionToPage('No', page, { x: 90, y: 500, width: 15, height: 15 });
  // A hidden sibling must not discard this field's visible widget.
  const shared = form.createTextField('shared');
  shared.addToPage(page, { x: 40, y: 400, width: 100, height: 20 });
  shared.addToPage(page, { x: 40, y: 350, width: 100, height: 20 });
  shared.acroField.getWidgets()[0].setFlag(AnnotationFlags.Hidden);
  const parsed = await parseDocument(await doc.save());
  expect(parsed.acroFields.map((field) => field.name)).toEqual([
    'visible',
    'choice',
    'choice',
    'shared',
  ]);
  expect(
    parsed.acroFields.filter((field) => field.name === 'choice').map((field) => field.options),
  ).toEqual([
    ['Yes', 'No'],
    ['Yes', 'No'],
  ]);
  expect(parsed.acroFields.every(({ bbox }) => bbox[2] > bbox[0] && bbox[3] > bbox[1])).toBe(true);
});

test('native widget types survive production class-name minification', async () => {
  const { nativeFieldType } = await import('@/lib/pdf-extract');
  const doc = await PDFDocument.create();
  const form = doc.getForm();
  const field = form.createRadioGroup('choice');
  const constructor = field.constructor;
  const original = Object.getOwnPropertyDescriptor(constructor, 'name')!;
  try {
    Object.defineProperty(constructor, 'name', { ...original, value: 'e' });
    expect(nativeFieldType(field)).toBe('PDFRadioGroup');
    expect(nativeFieldType(form.createTextField('name'))).toBe('PDFTextField');
    expect(nativeFieldType(form.createCheckBox('yes'))).toBe('PDFCheckBox');
  } finally {
    Object.defineProperty(constructor, 'name', original);
  }
});
