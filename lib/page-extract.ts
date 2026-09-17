import type { z } from 'zod';
import type { ModelMessage } from 'ai';
import { ObjectExtract } from './object-extract';
import { generateValidated } from './llm';
import type { ParsedDocument } from './pdf-extract';
import type { FormSchema } from './schema';
import { objectExtractPrompt } from '@/prompts/extract-object';

type Extraction = z.infer<typeof ObjectExtract>;
function languageCode(value: string) {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    english: 'en',
    spanish: 'es',
    japanese: 'ja',
    chinese: 'zh',
    french: 'fr',
    german: 'de',
    portuguese: 'pt',
    arabic: 'ar',
  };
  return aliases[normalized] ?? normalized;
}
export function canExtractPagePair(doc: ParsedDocument) {
  return (
    doc.pages.length === 2 &&
    doc.acroFields.length === 0 &&
    doc.pages.every((p) => p.kind === 'text')
  );
}

export function mergePageExtractions(input: Extraction[]): Extraction {
  if (input.length !== 2) throw new Error('Expected exactly two page results');
  const pages = input.map((value) => ObjectExtract.parse(value));
  const result: Extraction = {
    title: pages[0].title,
    language: languageCode(pages[0].language),
    sections: [],
    rows: [],
    signature: -1,
    date: -1,
    name: -1,
    exclusiveGroups: [],
  };
  let signatures = 0;
  pages.forEach((page, index) => {
    if (languageCode(page.language) !== result.language)
      throw new Error('Page results disagree on the form language');
    if (page.rows.some((r) => r.p !== index || (r.s ?? 0) >= page.sections.length))
      throw new Error('Page result contains an invalid page or section');
    const fieldOffset = result.rows.length,
      sectionOffset = result.sections.length;
    const reference = (value: number | string) => {
      if (typeof value === 'string' || value === -1) return value;
      if (value >= page.rows.length) throw new Error('Invalid page-local field reference');
      return value + fieldOffset;
    };
    result.sections.push(...page.sections);
    result.rows.push(
      ...page.rows.map((r) => ({
        ...r,
        s: (r.s ?? 0) + sectionOffset,
        ...(r.d ? { d: { ...r.d, row: reference(r.d.row) } } : {}),
      })),
    );
    result.exclusiveGroups!.push(...(page.exclusiveGroups ?? []).map((g) => g.map(reference)));
    if (page.signature !== -1) {
      if (++signatures > 1) throw new Error('Page results disagree on the primary signature');
      result.signature = reference(page.signature);
      result.date = reference(page.date);
      result.name = reference(page.name);
    } else if (page.date !== -1 || page.name !== -1) {
      throw new Error('Page has signer references without a primary signature');
    }
  });
  return ObjectExtract.parse(result);
}

// Both requests retain the complete document context, including cross-page instructions.
// An unsuccessful pair is discarded as a whole; callers can retry the full document.
export async function extractPagePair(
  doc: ParsedDocument,
  images: Uint8Array[],
  validate: (value: Extraction) => FormSchema,
  signal: AbortSignal,
): Promise<FormSchema> {
  if (!canExtractPagePair(doc) || images.length !== 2) throw new Error('Unsupported page pair');
  const controller = new AbortController();
  const pageSignal = AbortSignal.any([signal, controller.signal]);
  const jobs = doc.pages.map(async (_, page) => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              objectExtractPrompt(doc) +
              `\nThis is a parallel page task. Extract ONLY fields on page index ${page}. Use ALL supplied pages as context, but no row may have p different from ${page}. Include every applicant/prescriber input on the target page, including repeated table cells. Return rows=[] if this page contains instructions only. Root language must be a language code such as en, es or zh-CN, never a language name. Return root signature only for the primary applicant/guardian signature if it is on this target page; otherwise set signature/date/name to -1. Do not select prescriber/notary signatures as the primary applicant. All dependency/signature/group references must use exact unique human labels rather than numeric row indices; cross-page references may name an actual field on another page.`,
          },
          ...images.map((image) => ({ type: 'image' as const, image, mediaType: 'image/jpeg' })),
        ],
      },
    ];
    try {
      return await generateValidated(
        ObjectExtract,
        messages,
        (value) => {
          if (value.rows.some((r) => r.p !== page))
            throw new Error('Field belongs to another page');
          return value;
        },
        pageSignal,
        1,
      );
    } catch (error) {
      controller.abort();
      throw error;
    }
  });
  try {
    return validate(mergePageExtractions(await Promise.all(jobs)));
  } finally {
    controller.abort();
    await Promise.allSettled(jobs);
  }
}
