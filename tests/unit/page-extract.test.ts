import { afterEach, expect, test, vi } from 'vitest';
import type { z } from 'zod';
vi.mock('@/lib/llm', () => ({ generateValidated: vi.fn() }));
vi.mock('@/lib/pdf-extract', async (original) => ({
  ...(await original<typeof import('@/lib/pdf-extract')>()),
  parseDocument: vi.fn(),
}));
import { generateValidated } from '@/lib/llm';
import { parseDocument, type ParsedDocument } from '@/lib/pdf-extract';
import { ObjectExtract, hydrateObjectExtract } from '@/lib/object-extract';
import { canExtractPagePair, extractPagePair, mergePageExtractions } from '@/lib/page-extract';
import { extractForm, groundSchema } from '@/lib/extract-form';
type Raw = z.infer<typeof ObjectExtract>;
const doc: ParsedDocument = {
  source: 'pdf',
  acroFields: [],
  pages: [0, 1].map((index) => ({
    index,
    kind: 'text',
    widthPt: 612,
    heightPt: 792,
    textItems: ['Permission', 'Name', 'Signature', 'Date', 'Notes', 'Allow', 'Deny'].map(
      (str, i) => ({ str, x: 20, y: 40 + i * 30, w: 100, h: 10, size: 10 }),
    ),
  })),
};
const row = (
  l: string,
  t: Raw['rows'][number]['t'],
  p: number,
  x: number,
): Raw['rows'][number] => ({ l, t, p, x, b: [0.2, 0.2, 0.6, 0.23] });
const pages: Raw[] = [
  {
    title: 'Permission form',
    language: 'en',
    sections: ['Applicant'],
    signature: -1,
    date: -1,
    name: -1,
    rows: [row('Permission', 'checkbox', 0, 0), row('Name', 'text', 0, 1)],
  },
  {
    title: 'Permission form',
    language: 'en',
    sections: ['Signature'],
    signature: 'Signature',
    date: 'Date',
    name: 'Name',
    rows: [
      row('Signature', 'signature', 1, 2),
      row('Date', 'date', 1, 3),
      { ...row('Notes', 'text', 1, 4), d: { row: 'Permission', equals: 'true' } },
    ],
  },
];
const validate = (value: Raw) => groundSchema(hydrateObjectExtract(value, doc), doc);
const images = [new Uint8Array([255, 216, 1]), new Uint8Array([255, 216, 2])];
const copy = () => structuredClone(pages);
function mockSources() {
  vi.stubEnv('LLM_PROVIDER', 'doubao');
  vi.mocked(parseDocument).mockImplementation(async (bytes) =>
    bytes[0] === 1
      ? doc
      : {
          source: 'image',
          acroFields: [],
          pages: [{ index: 0, kind: 'scan', widthPt: 100, heightPt: 100, textItems: [] }],
        },
  );
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

test('merges cross-page dependency and signer references through unchanged grounding', () => {
  const schema = validate(mergePageExtractions(copy()));
  expect(schema.fields).toHaveLength(5);
  expect(schema.fields[4].dependsOn).toEqual({ fieldId: 'f0', equals: 'true' });
  expect(schema.signature).toEqual({ fieldId: 'f2', dateFieldId: 'f3', nameFieldId: 'f1' });
  expect(schema.fields[2].section).toBe('s1');
});
test('normalizes the observed English/en spelling difference without treating Spanish as English', () => {
  const input = copy();
  input[0].language = 'English';
  expect(validate(mergePageExtractions(input)).language).toBe('en');
  input[1].language = 'Spanish';
  expect(() => mergePageExtractions(input)).toThrow('language');
});
test('reindexes local numeric references and checkbox groups without changing their target', () => {
  const input = copy();
  input[1].rows.push(row('Allow', 'checkbox', 1, 5), row('Deny', 'checkbox', 1, 6));
  input[1].signature = 0;
  input[1].date = 1;
  input[1].exclusiveGroups = [[3, 4]];
  input[1].rows[2].d = { row: 3, equals: 'true' };
  const schema = validate(mergePageExtractions(input));
  expect(schema.signature?.fieldId).toBe('f2');
  expect(schema.fields[4].dependsOn?.fieldId).toBe('f5');
  expect(schema.fields[5].exclusiveWith).toEqual(['f6']);
});
test('rejects mismatched pages, languages, ambiguous signatures and invalid local references', () => {
  const mutations: ((p: Raw[]) => void)[] = [
    (p) => {
      p[1].rows[0].p = 0;
    },
    (p) => {
      p[1].language = 'es';
    },
    (p) => {
      p[0].signature = 0;
    },
    (p) => {
      p[0].rows[0].s = 1;
    },
    (p) => {
      p[0].rows[1].d = { row: 2, equals: 'true' };
    },
    (p) => {
      p[0].name = 1;
    },
  ];
  for (const mutate of mutations) {
    const input = copy();
    mutate(input);
    expect(() => mergePageExtractions(input)).toThrow();
  }
});
test('retains fields when the other page has instructions only and enforces aggregate bounds', () => {
  const input = copy();
  input[1] = { ...input[1], rows: [], signature: -1, date: -1, name: -1 };
  expect(validate(mergePageExtractions(input)).fields).toHaveLength(2);
  const oversized = copy();
  oversized.forEach((p, i) => {
    p.rows = Array.from({ length: 76 }, (_, n) => row('Field ' + i + ' ' + n, 'text', i, 1));
    p.signature = -1;
    p.date = -1;
    p.name = -1;
  });
  expect(() => mergePageExtractions(oversized)).toThrow();
});
test('only eligible two-page text PDFs without native widgets use parallel extraction', () => {
  expect(canExtractPagePair(doc)).toBe(true);
  for (const candidate of [
    { ...doc, pages: [doc.pages[0]] },
    { ...doc, pages: [...doc.pages, doc.pages[0]] },
    { ...doc, pages: doc.pages.map((p) => ({ ...p, kind: 'scan' as const })) },
    {
      ...doc,
      acroFields: [
        {
          name: 'Name',
          type: 'PDFTextField',
          page: 0,
          bbox: [0.1, 0.1, 0.2, 0.2] as [number, number, number, number],
        },
      ],
    },
  ])
    expect(canExtractPagePair(candidate)).toBe(false);
});
test('runs two requests concurrently with complete context and merges only after both finish', async () => {
  const resolve: ((value: Raw) => void)[] = [];
  vi.mocked(generateValidated).mockImplementation(
    (_schema, messages, _verify, signal, attempts) => {
      expect(attempts).toBe(1);
      expect(signal?.aborted).toBe(false);
      const content = messages[0].content as { type: string }[];
      expect(content.filter((c) => c.type === 'image')).toHaveLength(2);
      return new Promise((r) => resolve.push(r)) as never;
    },
  );
  const job = extractPagePair(doc, images, validate, new AbortController().signal);
  expect(resolve).toHaveLength(2);
  resolve[1](pages[1]);
  resolve[0](pages[0]);
  expect((await job).fields).toHaveLength(5);
});
test('cancels and settles the sibling request before rejecting the pair', async () => {
  let siblingSettled = false;
  vi.mocked(generateValidated).mockImplementationOnce(async () => {
    throw new Error('first page failed');
  });
  vi.mocked(generateValidated).mockImplementationOnce(async (_s, _m, _v, signal) => {
    if (!signal!.aborted)
      await new Promise<void>((r) => signal!.addEventListener('abort', () => r(), { once: true }));
    siblingSettled = true;
    throw new Error('sibling cancelled');
  });
  await expect(
    extractPagePair(doc, images, validate, new AbortController().signal),
  ).rejects.toThrow('first page failed');
  expect(siblingSettled).toBe(true);
});
test('invalid merged output falls back once to whole-document extraction within the same live budget', async () => {
  mockSources();
  const invalid = copy();
  invalid[0].language = 'es';
  vi.mocked(generateValidated)
    .mockResolvedValueOnce(invalid[0] as never)
    .mockResolvedValueOnce(invalid[1] as never);
  vi.mocked(generateValidated).mockImplementationOnce(
    async (schema, _messages, verify, signal, attempts) => {
      expect(signal?.aborted).toBe(false);
      expect(attempts).toBe(1);
      return verify!(schema.parse(mergePageExtractions(copy())));
    },
  );
  expect((await extractForm(new Uint8Array([1]), images)).fields).toHaveLength(5);
  expect(generateValidated).toHaveBeenCalledTimes(3);
});
test('caller cancellation prevents a whole-document retry', async () => {
  mockSources();
  const controller = new AbortController();
  vi.mocked(generateValidated).mockImplementation(async (_s, _m, _v, signal) => {
    controller.abort();
    expect(signal!.aborted).toBe(true);
    throw { status: 502, code: 'llm_error', message: 'Cancelled' };
  });
  await expect(extractForm(new Uint8Array([1]), images, controller.signal)).rejects.toMatchObject({
    code: 'llm_error',
  });
  expect(generateValidated).toHaveBeenCalledTimes(2);
});
test.each([
  [280000, 120000],
  [10000, 5000],
])('a stalled pair reserves fallback time within a %i ms total budget', async (total, pair) => {
  mockSources();
  vi.stubEnv('LLM_TIMEOUT_MS', String(total));
  const totalDeadline = new AbortController();
  const pairDeadline = new AbortController();
  const timeout = vi
    .spyOn(AbortSignal, 'timeout')
    .mockReturnValueOnce(totalDeadline.signal)
    .mockReturnValueOnce(pairDeadline.signal);
  const started = Promise.withResolvers<void>();
  let active = 0;
  const stall: typeof generateValidated = async (_s, _m, _v, signal) => {
    if (++active === 2) started.resolve();
    await new Promise<void>((resolve) =>
      signal!.addEventListener('abort', () => resolve(), { once: true }),
    );
    active--;
    throw { status: 502, code: 'llm_error', message: 'Page timed out' };
  };
  vi.mocked(generateValidated).mockImplementationOnce(stall).mockImplementationOnce(stall);
  vi.mocked(generateValidated).mockImplementationOnce(
    async (schema, _m, verify, signal, attempts) => {
      expect(active).toBe(0);
      expect(signal?.aborted).toBe(false);
      expect(attempts).toBe(1);
      return verify!(schema.parse(mergePageExtractions(copy())));
    },
  );
  try {
    const job = extractForm(new Uint8Array([1]), images);
    await started.promise;
    expect(timeout.mock.calls).toEqual([[total], [pair]]);
    pairDeadline.abort();
    expect((await job).fields).toHaveLength(5);
    expect(totalDeadline.signal.aborted).toBe(false);
    expect(generateValidated).toHaveBeenCalledTimes(3);
  } finally {
    timeout.mockRestore();
  }
});
test('the original total deadline still cancels a fallback after the pair deadline', async () => {
  mockSources();
  vi.stubEnv('LLM_TIMEOUT_MS', '280000');
  const totalDeadline = new AbortController();
  const pairDeadline = new AbortController();
  const timeout = vi
    .spyOn(AbortSignal, 'timeout')
    .mockReturnValueOnce(totalDeadline.signal)
    .mockReturnValueOnce(pairDeadline.signal);
  const pairStarted = Promise.withResolvers<void>();
  const fallbackStarted = Promise.withResolvers<void>();
  let calls = 0;
  vi.mocked(generateValidated).mockImplementation(async (_s, _m, _v, signal) => {
    calls++;
    if (calls === 2) pairStarted.resolve();
    if (calls === 3) fallbackStarted.resolve();
    await new Promise<void>((resolve) =>
      signal!.addEventListener('abort', () => resolve(), { once: true }),
    );
    throw { status: 502, code: 'llm_error', message: 'Timed out' };
  });
  try {
    const job = extractForm(new Uint8Array([1]), images);
    const rejection = expect(job).rejects.toMatchObject({ code: 'llm_error' });
    await pairStarted.promise;
    pairDeadline.abort();
    await fallbackStarted.promise;
    totalDeadline.abort();
    await rejection;
    expect(generateValidated).toHaveBeenCalledTimes(3);
  } finally {
    timeout.mockRestore();
  }
});
test('a content-policy refusal is returned without retrying the full document', async () => {
  mockSources();
  vi.mocked(generateValidated).mockRejectedValue({
    status: 422,
    code: 'llm_blocked',
    message: 'Blocked',
  });
  await expect(extractForm(new Uint8Array([1]), images)).rejects.toMatchObject({
    code: 'llm_blocked',
  });
  expect(generateValidated).toHaveBeenCalledTimes(2);
});
