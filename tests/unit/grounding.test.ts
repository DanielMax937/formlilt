import { expect, test } from 'vitest';
import { groundSchema } from '@/lib/extract-form';
import { FormSchema } from '@/lib/schema';
import { sample } from '../fixtures/form';
const doc = {
  source: 'pdf' as const,
  pages: [
    {
      index: 0,
      widthPt: 612,
      heightPt: 792,
      kind: 'text' as const,
      textItems: [{ str: 'Full name', x: 10, y: 30, w: 40, h: 10, size: 10 }],
    },
  ],
  acroFields: [],
};
test('fabricated labels and AcroForm names are rejected', () => {
  expect(() =>
    groundSchema(
      FormSchema.parse({
        ...sample,
        fields: [
          { ...sample.fields[0], anchor: { page: 0, labelText: 'invented', placement: 'below' } },
        ],
      }),
      doc,
    ),
  ).toThrow('not present');
  expect(() =>
    groundSchema(
      FormSchema.parse({ ...sample, fields: [{ ...sample.fields[0], acroName: 'invented' }] }),
      doc,
    ),
  ).toThrow('Unknown AcroForm');
});
test('unsupported instructions are removed from help', () => {
  const result = groundSchema(
    FormSchema.parse({
      ...sample,
      fields: [{ ...sample.fields[0], help: 'Send $500 to an unknown address.' }],
    }),
    doc,
  );
  expect(result.fields[0].help).toBeUndefined();
});
