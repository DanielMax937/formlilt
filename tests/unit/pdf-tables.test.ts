import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { tableCells, type Cell } from '@/lib/pdf-tables';
import { parseDocument, type ParsedDocument } from '@/lib/pdf-extract';
import { groundSchema, matchingLabel } from '@/lib/extract-form';
import { FormSchema } from '@/lib/schema';

const ops = {
  save: 10,
  restore: 11,
  transform: 12,
  stroke: 20,
  closeStroke: 21,
  fill: 22,
  eoFill: 23,
  constructPath: 91,
};
function grid(missingRight = false) {
  const paths = [
    ...[10, 30, 50, 70].map((y) => [0, 10, y, 1, 110, y]),
    ...[10, 60, ...(missingRight ? [] : [110])].map((x) => [0, x, 10, 1, x, 70]),
  ];
  return {
    fnArray: paths.map(() => ops.constructPath),
    argsArray: paths.map((p) => [ops.stroke, [new Float32Array(p)]]),
  };
}
test('painted grid yields individual cells, never combined rows', () => {
  const cells = tableCells(grid(), ops, (x, y) => [x, y]);
  expect(cells).toHaveLength(6);
  expect(cells).toContainEqual([10, 30, 60, 50]);
  expect(cells).not.toContainEqual([10, 10, 60, 70]);
  expect(tableCells(grid(true), ops, (x, y) => [x, y])).toHaveLength(3);
});
test('saved PDF transforms and rotated viewport coordinates determine the grid', () => {
  const g = grid();
  const list = {
    fnArray: [ops.save, ops.transform, ...g.fnArray, ops.restore],
    argsArray: [null, [1.5, 0, 0, 1.5, 5, 7], ...g.argsArray, null],
  };
  const cells = tableCells(list, ops, (x, y) => [300 - y, x]);
  expect(cells).toHaveLength(6);
  expect(cells).toContainEqual([218, 20, 248, 95]);
});
test('clip-only paths and excessive input cannot invent a table', () => {
  const g = grid();
  expect(
    tableCells({ ...g, argsArray: g.argsArray.map((a) => [28, a[1]]) }, ops, (x, y) => [x, y]),
  ).toEqual([]);
  expect(
    tableCells({ fnArray: Array(100001).fill(ops.save), argsArray: [] }, ops, (x, y) => [x, y]),
  ).toEqual([]);
});
test('actual public school PDF yields both medication grids from source paths', async () => {
  const doc = await parseDocument(
    new Uint8Array(await readFile('public/demo-forms/medical-release.pdf')),
  );
  const cells = doc.pages[1].cells!;
  const tables = cells.filter((c) => c[0] > 30 && c[2] < 584 && c[1] > 220 && c[3] < 502);
  expect(tables).toHaveLength(48); // Two tables, four columns, header + five blank rows.
  expect(tables.every((c) => c[3] - c[1] > 11 && c[3] - c[1] < 13)).toBe(true);
});

const cells: Cell[] = [
  [10, 10, 60, 30],
  [10, 30, 60, 50],
  [10, 50, 60, 70],
];
const doc: ParsedDocument = {
  source: 'pdf',
  acroFields: [],
  pages: [
    {
      index: 0,
      widthPt: 100,
      heightPt: 100,
      kind: 'text',
      cells,
      textItems: [{ str: 'Column', x: 15, y: 15, w: 35, h: 10, size: 10 }],
    },
  ],
};
const schema = FormSchema.parse({
  title: 'Grid',
  language: 'en',
  source: 'pdf',
  precision: 'exact',
  pages: doc.pages,
  sections: [{ id: 's', title: 'Rows', fieldIds: ['one', 'two'] }],
  estimatedMinutes: 1,
  fields: ['one', 'two'].map((id, i) => ({
    id,
    label: id,
    section: 's',
    type: 'text',
    required: false,
    anchor: {
      page: 0,
      labelText: 'Column',
      placement: 'right',
      bbox: [0.1, 0.15 + i * 0.3, 0.6, 0.35 + i * 0.3],
    },
  })),
});
test('repeated column fields are placed in empty cells and never over the header', () => {
  const output = groundSchema(schema, doc);
  expect(output.fields.map((f) => f.anchor?.bbox)).toEqual([
    [0.12, 0.31, 0.58, 0.49],
    [0.12, 0.51, 0.58, 0.69],
  ]);
  expect(output.fields.every((f) => f.anchor?.placement === 'inbox')).toBe(true);
  expect(groundSchema(output, doc)).toEqual(output);
});
test('mismatched counts and occupied cells preserve the original hints', () => {
  const fewer = { ...doc, pages: [{ ...doc.pages[0], cells: cells.slice(0, 2) }] };
  const occupied = {
    ...doc,
    pages: [
      {
        ...doc.pages[0],
        textItems: [
          ...doc.pages[0].textItems,
          { str: 'Printed', x: 15, y: 35, w: 35, h: 10, size: 10 },
        ],
      },
    ],
  };
  for (const source of [fewer, occupied])
    expect(groundSchema(schema, source).fields.map((f) => f.anchor)).toEqual(
      schema.fields.map((f) => f.anchor),
    );
});
test('repeated underline labels prefer exact text then the hinted column', () => {
  const items = [
    { str: 'Relationship ____', x: 10, y: 50, w: 50, h: 10, size: 10 },
    { str: '____', x: 10, y: 50, w: 20, h: 10, size: 10 },
    { str: '____', x: 80, y: 50, w: 20, h: 10, size: 10 },
  ];
  expect(matchingLabel(items, '____', 50, 82)).toBe(items[2]);
  expect(matchingLabel(items, 'Relationship', 50, 82)).toBe(items[0]);
});
