import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PDFDocument, degrees } from 'pdf-lib';
import { fillPdf } from '@/lib/fill-pdf';
import { parseDocument } from '@/lib/pdf-extract';
import { FormSchema, type Answers } from '@/lib/schema';
import { fixtureAnswers } from '../fixtures/answers';
const signature = async () =>
  'data:image/png;base64,' + (await readFile('tests/fixtures/signature.png')).toString('base64');
for (const slug of ['change-of-address', 'insurance-claim', 'medical-release'])
  test(`fills real ${slug} and preserves pages`, async () => {
    const schema = FormSchema.parse(
      JSON.parse(await readFile(`public/demo-forms/${slug}.schema.json`, 'utf8')),
    );
    const answers = fixtureAnswers(schema, await signature());
    const output = await fillPdf(await readFile(`public/demo-forms/${slug}.pdf`), schema, answers);
    const pdf = await PDFDocument.load(output);
    expect(pdf.getPageCount()).toBe(2);
    for (const field of schema.fields.filter(
      (f) => f.acroName && f.type === 'text' && answers[f.id]?.status === 'answered',
    ))
      expect(pdf.getForm().getTextField(field.acroName!).getText()).toBe(answers[field.id].value);
    const flat = await fillPdf(
      await readFile(`public/demo-forms/${slug}.pdf`),
      schema,
      answers,
      true,
    );
    expect((await PDFDocument.load(flat)).getForm().getFields()).toHaveLength(0);
  }, 20000);
async function fixture(rotation = 0) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 300]);
  page.setRotation(degrees(rotation));
  const text = doc.getForm().createTextField('person');
  text.addToPage(page, { x: 100, y: 170, width: 240, height: 30 });
  const bytes = await doc.save();
  const parsed = await parseDocument(bytes);
  const schema = FormSchema.parse({
    title: 'Test',
    language: 'en',
    source: 'pdf',
    precision: 'approximate',
    pages: parsed.pages.map(({ textItems, ...p }) => p),
    sections: [{ id: 's', title: 'Details', fieldIds: ['person'] }],
    fields: [
      {
        id: 'person',
        label: 'Full name',
        section: 's',
        type: 'text',
        required: true,
        acroName: 'person',
        anchor: { page: 0, placement: 'inbox', bbox: parsed.acroFields[0].bbox },
      },
    ],
    estimatedMinutes: 1,
  });
  return { bytes, schema };
}
test('writes Chinese native values and can flatten them without losing text', async () => {
  const { bytes, schema } = await fixture();
  const answers: Answers = { person: { status: 'answered', value: '陈美玲' } };
  const result = await fillPdf(bytes, schema, answers);
  expect((await PDFDocument.load(result)).getForm().getTextField('person').getText()).toBe(
    '陈美玲',
  );
  const flat = await fillPdf(bytes, schema, answers, true);
  expect((await parseDocument(flat)).pages[0].textItems.map((t) => t.str).join('')).toContain(
    '陈美玲',
  );
}, 20000);
test('photo input yields a PDF with text inside its specified box', async () => {
  const bytes = await readFile('tests/fixtures/photo.jpg');
  const parsed = await parseDocument(bytes);
  const schema = FormSchema.parse({
    title: 'Photo',
    language: 'en',
    source: 'image',
    precision: 'approximate',
    pages: parsed.pages.map(({ textItems, ...p }) => p),
    sections: [{ id: 's', title: 'Details', fieldIds: ['person'] }],
    fields: [
      {
        id: 'person',
        label: 'Full name',
        section: 's',
        type: 'text',
        required: true,
        anchor: { page: 0, placement: 'inbox', bbox: [0.4, 0.45, 0.95, 0.7] },
      },
    ],
    estimatedMinutes: 1,
  });
  const out = await fillPdf(bytes, schema, {
    person: { status: 'answered', value: 'Alex Rivera' },
  });
  const actual = await parseDocument(out);
  const text = actual.pages[0].textItems.find((t) => t.str === 'Alex Rivera')!;
  expect(text).toBeDefined();
  expect(text.x).toBeGreaterThanOrEqual(160);
  expect(text.x + text.w).toBeLessThanOrEqual(380);
});
test('rotated native fields preserve values and foreign files/invalid answers are rejected', async () => {
  const { bytes, schema } = await fixture(90);
  const answers: Answers = { person: { status: 'answered', value: 'Alex' } };
  expect(
    (await PDFDocument.load(await fillPdf(bytes, schema, answers)))
      .getForm()
      .getTextField('person')
      .getText(),
  ).toBe('Alex');
  await expect(fillPdf(bytes, schema, {})).rejects.toMatchObject({ status: 400 });
  await expect(
    fillPdf(bytes, { ...schema, pages: [{ ...schema.pages[0], widthPt: 100 }] }, answers),
  ).rejects.toMatchObject({ status: 400 });
});
for (const rotation of [0, 90, 180, 270])
  test(`overlay follows displayed coordinates on a ${rotation}-degree page`, async () => {
    const { bytes, schema } = await fixture(rotation);
    const changed = FormSchema.parse({
      ...schema,
      fields: [
        {
          ...schema.fields[0],
          acroName: undefined,
          anchor: { page: 0, placement: 'inbox', bbox: [0.2, 0.4, 0.7, 0.5] },
        },
      ],
    });
    const out = await fillPdf(bytes, changed, {
      person: { status: 'answered', value: 'ROTATION' },
    });
    const parsed = await parseDocument(out);
    const item = parsed.pages[0].textItems.find((t) => t.str === 'ROTATION')!;
    expect(item).toBeDefined();
    expect(item.x).toBeCloseTo(parsed.pages[0].widthPt * 0.2, 0);
    expect(item.y).toBeCloseTo(parsed.pages[0].heightPt * 0.4, 0);
  });

for (const rotation of [0, 90, 180, 270])
  test(`checkbox overlay stays centered in its displayed square at ${rotation} degrees`, async () => {
    const { bytes, schema } = await fixture(rotation);
    const checkbox = FormSchema.parse({
      ...schema,
      fields: [
        {
          ...schema.fields[0],
          type: 'checkbox',
          acroName: undefined,
          anchor: { page: 0, placement: 'inbox', bbox: [0.2, 0.4, 0.26, 0.46] },
        },
      ],
    });
    const selected = await parseDocument(
      await fillPdf(bytes, checkbox, {
        person: { status: 'answered', value: 'true' },
      }),
    );
    const page = selected.pages[0];
    const mark = page.textItems.find((item) => item.str === 'X')!;
    expect(mark).toBeDefined();
    expect(mark.x + mark.w / 2).toBeCloseTo(page.widthPt * 0.23, 0);
    expect(mark.y + mark.h / 2).toBeCloseTo(page.heightPt * 0.43, 0);
    expect(mark.x).toBeGreaterThan(page.widthPt * 0.2);
    expect(mark.x + mark.w).toBeLessThan(page.widthPt * 0.26);
    const empty = await parseDocument(
      await fillPdf(bytes, checkbox, {
        person: { status: 'answered', value: 'false' },
      }),
    );
    expect(empty.pages[0].textItems.some((item) => item.str === 'X')).toBe(false);
  });
