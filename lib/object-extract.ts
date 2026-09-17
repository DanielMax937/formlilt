// Named row properties avoid positional-column drift in Ark JSON output.
// Convert through the existing compact validator; public FormSchema is unchanged.
import { z } from 'zod';
import { Field } from './schema';
import { CompactExtract, hydrateExtract } from './compact-extract';
import type { ParsedDocument } from './pdf-extract';
const ref = z.union([z.number().int().min(-1), z.string().min(1).max(100)]);
const row = z
  .object({
    l: z.string().min(1).max(100),
    t: Field.shape.type,
    r: z.boolean().optional(),
    s: z.number().int().min(0).max(29).optional(),
    p: z.number().int().min(0).max(14),
    a: z.number().int().min(0).optional(),
    x: z.number().int().min(-1),
    b: z.array(z.number().min(0).max(1)).length(4).optional(),
    o: z.array(z.string().max(150)).max(80).optional(),
    d: z
      .object({ row: ref, equals: z.string().max(150) })
      .strict()
      .optional(),
    h: z.array(z.number().int().min(0)).max(4).optional(),
    c: Field.shape.constraints,
    q: z.string().trim().min(1).max(300).optional(),
  })
  .strict();
export const ObjectExtract = z
  .object({
    title: z.string().min(1).max(200),
    language: z.string().min(2).max(30),
    sections: z.array(z.string().min(1).max(100)).min(1).max(30),
    rows: z.array(row).max(150),
    signature: ref,
    date: ref,
    name: ref,
    exclusiveGroups: z.array(z.array(ref).min(2).max(21)).max(30).optional(),
  })
  .strict();
export function hydrateObjectExtract(value: z.infer<typeof ObjectExtract>, doc: ParsedDocument) {
  const resolve = (v: z.infer<typeof ref>) => {
    if (typeof v === 'number') return v;
    const matches = value.rows.flatMap((r, i) => (r.l === v ? [i] : []));
    if (matches.length !== 1) throw new Error('Dependency must identify one exact row label: ' + v);
    return matches[0];
  };
  const raw = CompactExtract.parse({
    ...value,
    rows: value.rows.map((r) => [
      r.l,
      r.t,
      r.r ?? false,
      r.s ?? 0,
      r.p,
      r.a ?? -1,
      r.x,
      r.b ?? [],
      r.o ?? [],
      r.d ? resolve(r.d.row) : -1,
      r.d?.equals ?? '',
      r.h ?? [],
      r.c ?? null,
    ]),
    scanHelp: value.rows.flatMap((r, i) => (r.q ? [[i, r.q]] : [])),
  });
  return hydrateExtract(raw, doc);
}
