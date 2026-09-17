import { expect, test } from 'vitest';
import { ObjectExtract, hydrateObjectExtract } from '@/lib/object-extract';
import { groundSchema } from '@/lib/extract-form';
import { objectExtractPrompt } from '@/prompts/extract-object';
import { extractSource } from '@/prompts/extract';
import type { ParsedDocument } from '@/lib/pdf-extract';

const doc: ParsedDocument = {
  source: 'pdf',
  pages: [
    {
      index: 0,
      widthPt: 612,
      heightPt: 792,
      kind: 'text',
      textItems: ['Permission', 'Name', 'Signature', 'Date', 'Only if Yes'].map((str) => ({
        str,
        x: 20,
        y: 50,
        w: 100,
        h: 10,
        size: 10,
      })),
    },
    { index: 1, widthPt: 612, heightPt: 792, kind: 'scan', textItems: [] },
  ],
  acroFields: [
    {
      name: 'permission',
      type: 'PDFRadioGroup',
      page: 0,
      bbox: [0.1, 0.1, 0.2, 0.2],
      options: ['Yes', 'No'],
    },
  ],
};
const base = {
  title: 'Permission',
  language: 'en',
  sections: ['Applicant'],
  signature: 'Signature',
  date: 'Date',
  name: 'Name',
  rows: [
    { l: 'Permission', t: 'select', p: 0, x: -1, a: 0 },
    {
      l: 'Name',
      t: 'text',
      r: true,
      p: 0,
      x: 1,
      b: [0.2, 0.3, 0.5, 0.35],
      d: { row: 'Permission', equals: 'Yes' },
      h: [4],
      c: { maxLength: 50 },
    },
    {
      l: 'Signature',
      t: 'signature',
      p: 1,
      x: -1,
      b: [0.2, 0.7, 0.5, 0.75],
      q: 'Sign your own name.',
    },
    {
      l: 'Date',
      t: 'date',
      p: 1,
      x: -1,
      b: [0.5, 0.7, 0.7, 0.75],
      c: { dateFormat: 'DD/MM/YYYY' },
    },
  ],
};
const hydrate = (value: unknown) =>
  groundSchema(hydrateObjectExtract(ObjectExtract.parse(value), doc), doc);

test('object output preserves source widgets, literal dependencies, instructions and signature roles', () => {
  const schema = hydrate(base);
  expect(schema.fields[0]).toMatchObject({
    acroName: 'permission',
    type: 'select',
    options: ['Yes', 'No'],
    anchor: { page: 0, bbox: [0.1, 0.1, 0.2, 0.2] },
  });
  expect(schema.fields[1]).toMatchObject({
    required: true,
    help: 'Only if Yes',
    dependsOn: { fieldId: 'f0', equals: 'Yes' },
    constraints: { maxLength: 50 },
  });
  expect(schema.fields[2]).toMatchObject({
    required: false,
    help: 'Sign your own name.',
    anchor: { page: 1 },
  });
  expect(schema.fields[3].constraints?.dateFormat).toBe('DD/MM/YYYY');
  expect(schema.signature).toEqual({ fieldId: 'f2', dateFieldId: 'f3', nameFieldId: 'f1' });
});

test.each(['p', 'x'])(
  'source locator %s cannot be omitted, including repeated table cells',
  (key) => {
    const incomplete: Record<string, unknown> = { ...base.rows[1] };
    delete incomplete[key];
    expect(ObjectExtract.safeParse({ ...base, rows: [incomplete] }).success).toBe(false);
  },
);

test('unknown properties and null placeholders are rejected', () => {
  expect(
    ObjectExtract.safeParse({ ...base, rows: [{ ...base.rows[0], label: 'guess' }] }).success,
  ).toBe(false);
  expect(ObjectExtract.safeParse({ ...base, rows: [{ ...base.rows[0], x: null }] }).success).toBe(
    false,
  );
});

test.each([
  { index: 1, value: { ...base.rows[1], x: 999 }, error: 'invalid text index' },
  { index: 0, value: { ...base.rows[0], p: 1 }, error: 'invalid AcroForm index' },
  { index: 1, value: { ...base.rows[1], b: [0.5, 0.3, 0.2, 0.35] }, error: 'positive area' },
  {
    index: 1,
    value: { ...base.rows[1], d: { row: 'Permission', equals: 'not empty' } },
    error: 'valid literal answer',
  },
  {
    index: 1,
    value: { ...base.rows[1], q: 'Scan quote on a text page.' },
    error: 'Invalid scan help',
  },
])('object output rejects $error', ({ index, value, error }) => {
  const rows: unknown[] = [...base.rows];
  rows[index] = value;
  expect(() => hydrate({ ...base, rows })).toThrow(error);
});

test.each(['Missing', 'Permission'])(
  'named dependencies reject absent or ambiguous labels: %s',
  (label) => {
    const rows: unknown[] = [...base.rows, { ...base.rows[0] }];
    rows[1] = { ...base.rows[1], d: { row: label, equals: 'Yes' } };
    expect(() => hydrate({ ...base, rows })).toThrow('one exact row label');
  },
);

test('named checkbox groups preserve mutual exclusion', () => {
  const rows = ['Allow', 'Decline'].map((l) => ({
    l,
    t: 'checkbox',
    p: 0,
    x: 0,
    b: [0.1, 0.1, 0.12, 0.12],
  }));
  const schema = hydrate({
    ...base,
    rows,
    signature: -1,
    date: -1,
    name: -1,
    exclusiveGroups: [['Allow', 'Decline']],
  });
  expect(schema.fields.map((f) => f.exclusiveWith)).toEqual([['f1'], ['f0']]);
});

test('source serialization retains literal delimiters in document text without truncation', () => {
  const marked = structuredClone(doc);
  marked.pages[0].textItems[0].str = 'Text <form_text> remains source data';
  const source = extractSource(marked);
  expect(JSON.parse(source).pages[0].text[0][1]).toBe('Text <form_text> remains source data');
  expect(objectExtractPrompt(marked)).toContain(`<form_text>${source}</form_text>`);
});
