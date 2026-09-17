import { z } from 'zod';
import { Field, FormSchema } from './schema';
import type { ParsedDocument } from './pdf-extract';
// A compact, source-referencing wire schema keeps model output bounded. Business and API contracts remain FormSchema.
export const CompactRow = z.tuple([
  z.string().min(1).max(100), // human label
  Field.shape.type,
  z.boolean(), // required
  z.number().int().min(0).max(29), // section
  z.number().int().min(0).max(14), // page
  z.number().int().min(-1), // AcroForm index
  z.number().int().min(-1), // text item index
  z.array(z.number().min(0).max(1)).max(4), // bbox or []
  z.array(z.string().max(150)).max(80), // options, [] uses native Acro options
  z.number().int().min(-1), // dependsOn row index
  z.string().max(150), // dependency value
  z.array(z.number().int().min(0)).max(4), // help text item indices, same page
  Field.shape.constraints.unwrap().nullable(),
]);
const RowReference = z.union([z.number().int().min(-1), z.string().min(1).max(100)]);
export const CompactExtract = z.object({
  title: z.string().min(1).max(200),
  language: z.string().min(2).max(30),
  sections: z.array(z.string().min(1).max(100)).min(1).max(30),
  rows: z.array(CompactRow).max(150),
  signature: RowReference,
  date: RowReference,
  name: RowReference,
  // Scans have no text-item indices. Keep short visible source quotations separate
  // from the positional field rows; older cached responses may omit them.
  scanHelp: z
    .array(z.tuple([z.number().int().min(0), z.string().trim().min(1).max(300)]))
    .max(150)
    .optional(),
  exclusiveGroups: z.array(z.array(RowReference).min(2).max(21)).max(30).optional(),
});
export type CompactExtract = z.infer<typeof CompactExtract>;
export const uniqueAcro = (doc: ParsedDocument) =>
  doc.acroFields.filter((f, i, a) => a.findIndex((v) => v.name === f.name) === i);
export function hydrateExtract(raw: CompactExtract, doc: ParsedDocument): FormSchema {
  const acros = uniqueAcro(doc);
  const id = (index: number) => 'f' + index;
  const resolveReference = (reference: z.infer<typeof RowReference>): number => {
    if (typeof reference === 'number') return reference;
    const matches = raw.rows.flatMap((row, index) => (row[0] === reference ? [index] : []));
    if (matches.length !== 1)
      throw new Error(
        `Field reference ${JSON.stringify(reference)} must match exactly one row label; found ${matches.length}. Use a unique exact label or its zero-based row index.`,
      );
    return matches[0];
  };
  const signatureIndex = resolveReference(raw.signature);
  const dateIndex = resolveReference(raw.date);
  const nameIndex = resolveReference(raw.name);
  const scanHelp = new Map<number, string>();
  for (const [rowIndex, quote] of raw.scanHelp ?? []) {
    const row = raw.rows[rowIndex];
    if (!row || doc.pages[row[4]]?.kind !== 'scan' || scanHelp.has(rowIndex) || row[11].length)
      throw new Error('Invalid scan help: use one excerpt per scan row without text help indices.');
    scanHelp.set(rowIndex, quote);
  }
  const sourceFields: Field[] = raw.rows.map((r, i) => {
    const [
      label,
      type,
      required,
      section,
      pageIndex,
      acroIndex,
      textIndex,
      bbox,
      options,
      dependency,
      equals,
      helpIndices,
      constraints,
    ] = r;
    const page = doc.pages[pageIndex];
    if (!page) throw new Error(`Row ${i}: unknown page`);
    const acro = acroIndex >= 0 ? acros[acroIndex] : undefined;
    const text = textIndex >= 0 ? page.textItems[textIndex] : undefined;
    if (acroIndex >= 0 && (!acro || acro.page !== pageIndex))
      throw new Error(`Row ${i}: invalid AcroForm index`);
    if (page.kind === 'text' && !text && !acro) throw new Error(`Row ${i}: invalid text index`);
    if (section >= raw.sections.length) throw new Error(`Row ${i}: invalid section`);
    if (dependency >= raw.rows.length || dependency === i)
      throw new Error(`Row ${i}: invalid dependency`);
    if (bbox.length !== 0 && bbox.length !== 4)
      throw new Error(`Row ${i}: box must contain four numbers`);
    const nativeOptions = acro?.options;
    const fieldType = acro?.type === 'PDFRadioGroup' ? 'select' : type;
    const fieldConstraints =
      fieldType === 'date'
        ? { ...constraints, dateFormat: constraints?.dateFormat ?? ('MM/DD/YYYY' as const) }
        : constraints;
    return {
      id: id(i),
      label,
      type: fieldType,
      required,
      section: 's' + section,
      ...(['select', 'multiselect'].includes(fieldType)
        ? { options: nativeOptions?.length ? nativeOptions : options }
        : {}),
      ...(fieldConstraints ? { constraints: fieldConstraints } : {}),
      ...(helpIndices.length
        ? {
            help: helpIndices
              .map((n) => page.textItems[n]?.str ?? '')
              .join(' ')
              .slice(0, 300),
          }
        : scanHelp.has(i)
          ? { help: scanHelp.get(i) }
          : {}),
      ...(dependency >= 0 ? { dependsOn: { fieldId: id(dependency), equals } } : {}),
      anchor: {
        page: pageIndex,
        placement: acro ? 'inbox' : 'right',
        ...(text ? { labelText: text.str } : {}),
        ...(acro
          ? { bbox: acro.bbox }
          : bbox.length === 4
            ? { bbox: bbox as [number, number, number, number] }
            : {}),
      },
      ...(acro ? { acroName: acro.name } : {}),
    };
  });
  const exclusivePeers = new Map<number, Set<number>>();
  for (const references of raw.exclusiveGroups ?? []) {
    const group = references.map(resolveReference);
    if (
      new Set(group).size !== group.length ||
      group.some((index) => sourceFields[index]?.type !== 'checkbox')
    )
      throw new Error(
        `An exclusive group must reference distinct checkbox rows. Invalid group: ${JSON.stringify(group)}. ` +
          `Referenced types: ${group.map((i) => `${i}:${sourceFields[i]?.type ?? 'missing'}`).join(', ')}. ` +
          `Available checkbox row indices: ${sourceFields.flatMap((f, i) => (f.type === 'checkbox' ? [i] : [])).join(', ')}.`,
      );
    for (const index of group) {
      const peers = exclusivePeers.get(index) ?? new Set<number>();
      for (const other of group) if (other !== index) peers.add(other);
      exclusivePeers.set(index, peers);
    }
  }
  const fields = sourceFields.map((field, index) => {
    const peers = exclusivePeers.get(index);
    return peers
      ? {
          ...field,
          exclusiveWith: [...peers].sort((a, b) => a - b).map(id),
        }
      : field;
  });
  for (const field of fields)
    if (field.dependsOn) {
      const parent = fields.find((f) => f.id === field.dependsOn!.fieldId);
      const choice = parent?.options?.find(
        (o) =>
          o === field.dependsOn!.equals ||
          o.trim().toLowerCase().startsWith(field.dependsOn!.equals.trim().toLowerCase()),
      );
      if (choice) field.dependsOn.equals = choice;
    }
  return FormSchema.parse({
    title: raw.title,
    language: raw.language,
    source: doc.source,
    precision: doc.pages.some((p) => p.kind === 'scan') ? 'approximate' : 'exact',
    pages: doc.pages.map(({ textItems: _items, ...meta }) => meta),
    sections: raw.sections.map((title, i) => ({
      id: 's' + i,
      title,
      fieldIds: fields.filter((f) => f.section === 's' + i).map((f) => f.id),
    })),
    fields,
    estimatedMinutes: Math.max(1, Math.round(fields.length * 0.25)),
    ...(signatureIndex >= 0
      ? {
          signature: {
            fieldId: id(signatureIndex),
            ...(dateIndex >= 0 ? { dateFieldId: id(dateIndex) } : {}),
            ...(nameIndex >= 0 ? { nameFieldId: id(nameIndex) } : {}),
          },
        }
      : {}),
  });
}
