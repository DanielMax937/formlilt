import type { ModelMessage } from 'ai';
import { FormSchema, type Field } from './schema';
import { parseDocument, type ParsedDocument, type TextItem } from './pdf-extract';
import { generateValidated } from './llm';
import { CompactExtract, hydrateExtract } from './compact-extract';
import { extractPrompt } from '@/prompts/extract';
import { fail } from './errors';
import { getEnv } from './env';
import { ObjectExtract, hydrateObjectExtract } from './object-extract';
import { objectExtractPrompt } from '@/prompts/extract-object';
import { canExtractPagePair, extractPagePair } from './page-extract';
export function matchingLabel(items: TextItem[], label: string, hintY = 0, hintX?: number) {
  const exact = items.filter((t) => t.str === label);
  const matches = exact.length ? exact : items.filter((t) => t.str.includes(label));
  return matches.sort((a, b) => {
    const vertical = Math.abs(a.y - hintY) - Math.abs(b.y - hintY);
    return Math.abs(vertical) > 1 || hintX === undefined
      ? vertical
      : Math.abs(a.x - hintX) - Math.abs(b.x - hintX);
  })[0];
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
        label &&
        matchingLabel(
          page.textItems,
          label,
          (anchor.bbox?.[1] ?? 0) * page.heightPt,
          anchor.bbox?.[0] === undefined ? undefined : anchor.bbox[0] * page.widthPt,
        );
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
    fields: alignTableFields(fields, doc),
  });
}

// Repeated fields using a column heading can be aligned only when the PDF itself
// supplies a complete, matching number of empty cells. No inferred grid or OCR.
function alignTableFields(fields: Field[], doc: ParsedDocument): Field[] {
  const aligned = new Map<string, Field['anchor']>();
  const groups = new Map<TextItem, Field[]>();
  for (const field of fields) {
    const a = field.anchor,
      page = a && doc.pages[a.page];
    if (
      !a?.bbox ||
      !page?.cells?.length ||
      field.acroName ||
      !a.labelText ||
      /_{3,}/.test(a.labelText) ||
      ['checkbox', 'signature'].includes(field.type)
    )
      continue;
    const label = matchingLabel(
      page.textItems,
      a.labelText,
      a.bbox[1] * page.heightPt,
      a.bbox[0] * page.widthPt,
    );
    if (label) groups.set(label, [...(groups.get(label) ?? []), field]);
  }
  for (const [label, group] of groups) {
    if (group.length < 2) continue;
    const page = doc.pages[group[0].anchor!.page];
    const header = page.cells!.find(
      (c) =>
        c[0] <= label.x + 1 &&
        c[2] >= label.x + label.w - 1 &&
        c[1] <= label.y + 1 &&
        c[3] >= label.y + label.h - 1,
    );
    if (!header) continue;
    const column = page
      .cells!.filter(
        (c) =>
          Math.abs(c[0] - header[0]) < 1 && Math.abs(c[2] - header[2]) < 1 && c[1] >= header[3] - 1,
      )
      .sort((a, b) => a[1] - b[1]);
    const empty: typeof column = [];
    let end = header[3];
    for (const cell of column) {
      if (
        Math.abs(cell[1] - end) > 1.5 ||
        page.textItems.some(
          (t) =>
            t.x + t.w > cell[0] + 1 &&
            t.x < cell[2] - 1 &&
            t.y + t.h > cell[1] + 1 &&
            t.y < cell[3] - 1,
        )
      )
        break;
      empty.push(cell);
      end = cell[3];
    }
    if (empty.length !== group.length) continue;
    const ordered = [...group].sort((a, b) => a.anchor!.bbox![1] - b.anchor!.bbox![1]);
    if (
      ordered.some(
        (f, i) =>
          Math.abs(
            ((f.anchor!.bbox![1] + f.anchor!.bbox![3]) * page.heightPt) / 2 -
              (empty[i][1] + empty[i][3]) / 2,
          ) > Math.max(30, (empty[i][3] - empty[i][1]) * 2),
      )
    )
      continue;
    ordered.forEach((f, i) => {
      const c = empty[i];
      aligned.set(f.id, {
        ...f.anchor!,
        placement: 'inbox',
        bbox: [
          +((c[0] + 2) / page.widthPt).toFixed(6),
          +((c[1] + 1) / page.heightPt).toFixed(6),
          +((c[2] - 2) / page.widthPt).toFixed(6),
          +((c[3] - 1) / page.heightPt).toFixed(6),
        ],
      });
    });
  }
  return fields.map((f) => (aligned.has(f.id) ? { ...f, anchor: aligned.get(f.id) } : f));
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
  // Long flat forms need explicit property names; retain the verified native-widget path.
  const env = getEnv();
  const useObjectRows = env.LLM_PROVIDER === 'doubao' && document.acroFields.length === 0;
  const deadline = AbortSignal.timeout(env.LLM_TIMEOUT_MS);
  const extractionSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: useObjectRows ? objectExtractPrompt(document) : extractPrompt(document),
        },
        ...images.map((bytes) => ({
          type: 'image' as const,
          image: bytes,
          mediaType: 'image/jpeg',
        })),
      ],
    },
  ];
  if (useObjectRows) {
    const validate = (value: Parameters<typeof hydrateObjectExtract>[0]) => {
      if (!value.rows.length)
        return fail(422, 'schema_empty', 'No fillable fields were found in this file.');
      return groundSchema(hydrateObjectExtract(value, document), document);
    };
    let attempts = 2;
    if (canExtractPagePair(document)) {
      try {
        const result = await extractPagePair(document, images, validate, extractionSignal);
        console.info('form_extraction_path', 'page_pair');
        return result;
      } catch (error) {
        if (extractionSignal.aborted) throw error;
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          ['llm_blocked', 'llm_unconfigured', 'schema_empty'].includes(String(error.code))
        )
          throw error;
        // One whole-document attempt, using the remaining shared time budget.
        console.info('form_extraction_path', 'whole_document_fallback');
        attempts = 1;
      }
    }
    const raw = await generateValidated(
      ObjectExtract,
      messages,
      (value) => {
        validate(value);
        return value;
      },
      extractionSignal,
      attempts,
    );
    return groundSchema(hydrateObjectExtract(raw, document), document);
  }
  const raw = await generateValidated(
    CompactExtract,
    messages,
    (value) => {
      if (!value.rows.length)
        return fail(422, 'schema_empty', 'No fillable fields were found in this file.');
      groundSchema(hydrateExtract(value, document), document);
      return value;
    },
    extractionSignal,
  );
  return groundSchema(hydrateExtract(raw, document), document);
}
