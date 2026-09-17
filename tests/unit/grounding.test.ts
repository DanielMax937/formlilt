import { expect, test } from 'vitest';
import { groundSchema } from '@/lib/extract-form';
import { FormSchema } from '@/lib/schema';
import { sample } from '../fixtures/form';
import { CompactExtract, hydrateExtract } from '@/lib/compact-extract';
import { formatDate, validate } from '@/lib/validate';
import type { ParsedDocument } from '@/lib/pdf-extract';
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

const choices = {
  title: 'Wohnung',
  language: 'de',
  sections: ['Wohnung'],
  rows: ['Alleinige Wohnung', 'Hauptwohnung', 'Unrelated checkbox'].map((label) => [
    label,
    'checkbox',
    false,
    0,
    0,
    -1,
    0,
    [0.1, 0.1, 0.3, 0.13],
    [],
    -1,
    '',
    [],
    null,
  ]),
  signature: -1,
  date: -1,
  name: -1,
};

test('extracted exclusive checkbox groups reach answer validation in both directions', () => {
  const schema = hydrateExtract(
    CompactExtract.parse({ ...choices, exclusiveGroups: [[0, 1]] }),
    doc,
  );
  const answered = (id: string) => ({ [id]: { status: 'answered' as const, value: 'true' } });
  expect(validate(schema.fields[0], 'true', answered('f1')).code).toBe('invalid_exclusive');
  expect(validate(schema.fields[1], 'true', answered('f0')).code).toBe('invalid_exclusive');
  expect(validate(schema.fields[1], 'false', answered('f0')).ok).toBe(true);
  expect(validate(schema.fields[2], 'true', answered('f0')).ok).toBe(true);
});

test.each([
  [0, 0],
  [0, 99],
])('invalid exclusive references are rejected (%j)', (...group) => {
  expect(() =>
    hydrateExtract(CompactExtract.parse({ ...choices, exclusiveGroups: [group] }), doc),
  ).toThrow('distinct checkbox rows');
});

test('exclusive groups cannot refer to non-checkbox fields', () => {
  const rows = choices.rows.map((row, index) =>
    index === 1 ? [row[0], 'text', ...row.slice(2)] : row,
  );
  expect(() =>
    hydrateExtract(CompactExtract.parse({ ...choices, rows, exclusiveGroups: [[0, 1]] }), doc),
  ).toThrow('distinct checkbox rows');
});
test('long-form signature and exclusive references resolve exact labels after row reordering', () => {
  const row = (label: string, type = 'text') => [
    label,
    type,
    false,
    0,
    0,
    -1,
    0,
    [0.1, 0.1, 0.3, 0.13],
    [],
    -1,
    '',
    [],
    null,
  ];
  const schema = hydrateExtract(
    CompactExtract.parse({
      ...choices,
      rows: [
        ...Array.from({ length: 100 }, (_, i) => row(`Table cell ${i}`)),
        row('Parent signature', 'signature'),
        row('Signed date', 'date'),
        row('Parent name'),
        row('Permission: No', 'checkbox'),
        row('Permission: Yes', 'checkbox'),
      ],
      signature: 'Parent signature',
      date: 'Signed date',
      name: 'Parent name',
      exclusiveGroups: [['Permission: Yes', 'Permission: No']],
    }),
    doc,
  );
  expect(schema.signature).toEqual({ fieldId: 'f100', dateFieldId: 'f101', nameFieldId: 'f102' });
  expect(schema.fields[103].exclusiveWith).toEqual(['f104']);
  expect(schema.fields[104].exclusiveWith).toEqual(['f103']);
});
test.each(['Missing label', 'Repeated label'])(
  'missing or ambiguous named field references are rejected: %s',
  (reference) => {
    const rows = choices.rows.map((row) => ['Repeated label', ...row.slice(1)]);
    expect(() =>
      hydrateExtract(
        CompactExtract.parse({
          ...choices,
          rows,
          signature: reference,
        }),
        doc,
      ),
    ).toThrow('must match exactly one row label');
  },
);
test('named exclusive references still reject non-checkbox fields', () => {
  const rows = choices.rows.map((row, index) =>
    index === 1 ? [row[0], 'text', ...row.slice(2)] : row,
  );
  expect(() =>
    hydrateExtract(
      CompactExtract.parse({
        ...choices,
        rows,
        exclusiveGroups: [['Alleinige Wohnung', 'Hauptwohnung']],
      }),
      doc,
    ),
  ).toThrow('distinct checkbox rows');
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

const scanDoc: ParsedDocument = {
  source: 'pdf',
  pages: [{ ...doc.pages[0], kind: 'scan', textItems: [] }],
  acroFields: [],
};
const scannedInstructions = 'Please initial each statement to indicate your understanding.';
const scanRaw = {
  ...choices,
  rows: [
    ['Patient initials', 'text', true, 0, 0, -1, -1, [0.1, 0.1, 0.2, 0.14], [], -1, '', [], null],
  ],
  scanHelp: [[0, scannedInstructions]],
};
test.each(['pdf', 'image'] as const)(
  'scanned %s instructions survive extraction and grounding',
  (source) => {
    const document = { ...scanDoc, source };
    const schema = groundSchema(hydrateExtract(CompactExtract.parse(scanRaw), document), document);
    expect(schema.fields[0].help).toBe(scannedInstructions);
    expect(schema.precision).toBe('approximate');
  },
);
test('scan instructions remain available in a mixed text/scan document', () => {
  const document: ParsedDocument = {
    ...scanDoc,
    pages: [...doc.pages, { ...scanDoc.pages[0], index: 1 }],
  };
  const row = [...scanRaw.rows[0]];
  row[4] = 1;
  const schema = groundSchema(
    hydrateExtract(CompactExtract.parse({ ...scanRaw, rows: [row] }), document),
    document,
  );
  expect(schema.fields[0].help).toBe(scannedInstructions);
  expect(schema.fields[0].anchor?.page).toBe(1);
});
test.each([
  { scanHelp: [[99, scannedInstructions]] },
  {
    scanHelp: [
      [0, scannedInstructions],
      [0, 'A conflicting quote.'],
    ],
  },
])('unknown or duplicate scan excerpt references are rejected (%j)', ({ scanHelp }) => {
  expect(() => hydrateExtract(CompactExtract.parse({ ...scanRaw, scanHelp }), scanDoc)).toThrow(
    'scan help',
  );
});
test('one scan field cannot carry conflicting indexed and visual help', () => {
  const row = [...scanRaw.rows[0]];
  row[11] = [0];
  expect(() => hydrateExtract(CompactExtract.parse({ ...scanRaw, rows: [row] }), scanDoc)).toThrow(
    'scan help',
  );
});
test('scan excerpts cannot bypass text-page source checking', () => {
  expect(() =>
    hydrateExtract(CompactExtract.parse({ ...choices, scanHelp: [[0, 'Invented.']] }), doc),
  ).toThrow('scan help');
});
test('unreadable scan instructions stay absent rather than becoming invented advice', () => {
  const schema = hydrateExtract(CompactExtract.parse({ ...scanRaw, scanHelp: [] }), scanDoc);
  expect(schema.fields[0].help).toBeUndefined();
});

test.each([
  [null, '2026-09-17'],
  [{ maxLength: 10 }, '2026-09-17'],
  [{ dateFormat: 'DD/MM/YYYY' }, '17/09/2026'],
  [{ dateFormat: 'MM/DD/YYYY' }, '09/17/2026'],
])(
  'date extraction preserves specified order and avoids an ambiguous default (%j)',
  (constraints, expected) => {
    const raw = CompactExtract.parse({
      title: 'Anmeldung',
      language: 'de',
      sections: ['Datum'],
      rows: [
        ['Datum', 'date', true, 0, 0, -1, 0, [0.1, 0.1, 0.3, 0.13], [], -1, '', [], constraints],
      ],
      signature: -1,
      date: -1,
      name: -1,
    });
    const schema = hydrateExtract(raw, {
      ...doc,
      pages: [{ ...doc.pages[0], textItems: [{ ...doc.pages[0].textItems[0], str: 'Datum' }] }],
    });
    expect(formatDate('2026-09-17', schema.fields[0].constraints?.dateFormat)).toBe(expected);
    if (constraints && 'maxLength' in constraints)
      expect(schema.fields[0].constraints?.maxLength).toBe(10);
  },
);
