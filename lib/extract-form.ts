import type { ModelMessage } from 'ai';
import { FormSchema, type Field } from './schema';
import { parseDocument, type ParsedDocument, type TextItem } from './pdf-extract';
import { generateValidated } from './llm';
import { CompactExtract, hydrateExtract } from './compact-extract';
import { extractPrompt } from '@/prompts/extract';
import { fail } from './errors';
export function matchingLabel(items: TextItem[], label: string, hintY = 0) {
  const matches = items.filter((t) => t.str === label || t.str.includes(label));
  return matches.sort((a, b) => Math.abs(a.y - hintY) - Math.abs(b.y - hintY))[0];
}
export function groundSchema(schema: FormSchema, doc: ParsedDocument): FormSchema {
  const pages = doc.pages.map(({ textItems: _items, ...meta }) => meta);
  const fields: Field[] = schema.fields.map((field) => {
    const anchor = field.anchor;
    if (!anchor || !doc.pages[anchor.page]) throw new Error(`Invalid page for ${field.id}`);
    const page = doc.pages[anchor.page];
    const acro = field.acroName
      ? doc.acroFields.find((a) => a.name === field.acroName && a.page === anchor.page)
      : undefined;
    if (field.acroName && !acro) throw new Error(`Unknown AcroForm field ${field.acroName}`);
    let label = anchor.labelText;
    if (page.kind === 'text') {
      const matched =
        label && matchingLabel(page.textItems, label, (anchor.bbox?.[1] ?? 0) * page.heightPt);
      if (!matched) {
        if (!acro)
          throw new Error(
            `Field ${field.id}: anchor.labelText ${JSON.stringify(label)} is not present in text on page ${anchor.page}. Use an exact text item.`,
          );
        const nearest = [...page.textItems].sort(
          (a, b) =>
            Math.abs(a.y - acro.bbox[1] * page.heightPt) +
            Math.abs(a.x - acro.bbox[0] * page.widthPt) -
            (Math.abs(b.y - acro.bbox[1] * page.heightPt) +
              Math.abs(b.x - acro.bbox[0] * page.widthPt)),
        )[0];
        label = nearest?.str;
      }
    }
    // Only source excerpts can appear as explanatory evidence.
    const allText = doc.pages
      .flatMap((p) => p.textItems.map((t) => t.str))
      .join(' ')
      .replace(/\s+/g, ' ');
    const help =
      field.help && (page.kind === 'scan' || allText.includes(field.help.replace(/\s+/g, ' ')))
        ? field.help
        : undefined;
    return {
      ...field,
      help,
      anchor: { ...anchor, labelText: label, ...(acro ? { bbox: acro.bbox } : {}) },
    };
  });
  return FormSchema.parse({
    ...schema,
    source: doc.source,
    precision: doc.pages.some((p) => p.kind === 'scan') ? 'approximate' : 'exact',
    pages,
    fields,
  });
}
export async function extractForm(
  original: Uint8Array,
  images: Uint8Array[],
  signal?: AbortSignal,
) {
  let document: ParsedDocument;
  try {
    document = await parseDocument(original);
  } catch (e) {
    return fail(
      400,
      'upload_rejected',
      e instanceof Error ? e.message : 'This file could not be read.',
    );
  }
  if (images.length !== document.pages.length)
    return fail(400, 'upload_rejected', 'Upload one page image for every document page.');
  for (const bytes of images) {
    if (bytes.length > 1_500_000 || bytes[0] !== 255 || bytes[1] !== 216)
      fail(400, 'upload_rejected', 'Page images must be JPEG files.');
    const image = await parseDocument(bytes);
    if (
      image.source !== 'image' ||
      Math.max(image.pages[0].widthPt, image.pages[0].heightPt) > 1601
    )
      fail(400, 'upload_rejected', 'Page images must be no larger than 1600 pixels.');
  }
  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: extractPrompt(document) },
        ...images.map((bytes) => ({
          type: 'image' as const,
          image: bytes,
          mediaType: 'image/jpeg',
        })),
      ],
    },
  ];
  const raw = await generateValidated(
    CompactExtract,
    messages,
    (value) => {
      if (!value.rows.length)
        return fail(422, 'schema_empty', 'No fillable fields were found in this file.');
      groundSchema(hydrateExtract(value, document), document);
      return value;
    },
    signal,
  );
  return groundSchema(hydrateExtract(raw, document), document);
}
