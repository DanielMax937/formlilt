import { z } from 'zod';
import { languageCode } from './language-code';

const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine(
    (value) => !['__proto__', 'prototype', 'constructor'].includes(value),
    'Reserved field ID',
  );
const bounds = z
  .tuple([
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1),
  ])
  .refine((b) => b[2] > b[0] && b[3] > b[1], 'Bounding box must have positive area');
export const Field = z.object({
  id,
  label: z.string().min(1).max(200),
  section: id,
  type: z.enum([
    'text',
    'number',
    'date',
    'email',
    'phone',
    'select',
    'multiselect',
    'checkbox',
    'signature',
    'textarea',
  ]),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(150)).max(80).optional(),
  constraints: z
    .object({
      pattern: z.string().max(200).optional(),
      min: z.number().finite().optional(),
      max: z.number().finite().optional(),
      maxLength: z.number().int().min(1).max(10000).optional(),
      dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
    })
    .optional(),
  help: z.string().max(300).optional(),
  dependsOn: z.object({ fieldId: id, equals: z.string().max(150) }).optional(),
  exclusiveWith: z.array(id).max(20).optional(),
  anchor: z
    .object({
      page: z.number().int().min(0).max(14),
      labelText: z.string().min(1).max(300).optional(),
      bbox: bounds.optional(),
      placement: z.enum(['right', 'below', 'inbox']),
    })
    .optional(),
  acroName: z.string().min(1).max(500).optional(),
});
export type Field = z.infer<typeof Field>;
export const PageMeta = z.object({
  index: z.number().int().min(0).max(14),
  widthPt: z.number().positive().max(20000),
  heightPt: z.number().positive().max(20000),
  kind: z.enum(['text', 'scan']),
});
export type PageMeta = z.infer<typeof PageMeta>;
export const FormSchemaBase = z.object({
  title: z.string().min(1).max(200),
  language: z.string().min(2).max(30).transform(languageCode),
  source: z.enum(['pdf', 'image']),
  precision: z.enum(['exact', 'approximate']),
  pages: z.array(PageMeta).min(1).max(15),
  sections: z
    .array(z.object({ id, title: z.string().min(1).max(150), fieldIds: z.array(id).max(150) }))
    .min(1)
    .max(30),
  fields: z.array(Field).min(1).max(150),
  signature: z
    .object({ fieldId: id, dateFieldId: id.optional(), nameFieldId: id.optional() })
    .optional(),
  estimatedMinutes: z.number().min(0).max(120),
});
export const FormSchema = FormSchemaBase.superRefine((form, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  const fields = new Map(form.fields.map((f) => [f.id, f]));
  if (fields.size !== form.fields.length) fail('Field IDs must be unique');
  if (new Set(form.sections.map((s) => s.id)).size !== form.sections.length)
    fail('Section IDs must be unique');
  if (form.pages.some((p, i) => p.index !== i))
    fail('Page indices must be contiguous and zero-based');
  const listed = form.sections.flatMap((s) => s.fieldIds);
  if (
    listed.length !== fields.size ||
    new Set(listed).size !== fields.size ||
    listed.some((f) => !fields.has(f))
  )
    fail('Each field must occur in exactly one section');
  for (const f of form.fields) {
    if (!form.sections.some((s) => s.id === f.section && s.fieldIds.includes(f.id)))
      fail(`Invalid section for ${f.id}`);
    if (!f.anchor) fail(`Missing anchor for ${f.id}`);
    if (f.anchor && f.anchor.page >= form.pages.length) fail(`Page out of bounds for ${f.id}`);
    if (f.anchor && form.pages[f.anchor.page]?.kind === 'scan' && !f.anchor.bbox)
      fail(`Scan field ${f.id} requires a bounding box`);
    if (['select', 'multiselect'].includes(f.type) && !f.options?.length)
      fail(`Choice field ${f.id} requires options`);
    if (
      f.constraints?.min !== undefined &&
      f.constraints.max !== undefined &&
      f.constraints.min > f.constraints.max
    )
      fail(`Invalid numeric range for ${f.id}`);
    for (const ref of f.exclusiveWith ?? [])
      if (!fields.has(ref) || ref === f.id) fail(`Invalid exclusive reference for ${f.id}`);
    const seen = new Set([f.id]);
    let dep = f.dependsOn?.fieldId;
    while (dep) {
      if (seen.has(dep) || !fields.has(dep)) {
        fail(`Invalid or cyclic dependency for ${f.id}`);
        break;
      }
      seen.add(dep);
      dep = fields.get(dep)?.dependsOn?.fieldId;
    }
  }
  if (form.signature && fields.get(form.signature.fieldId)?.type !== 'signature')
    fail('Signature reference must name a signature field');
  if (form.signature?.dateFieldId && fields.get(form.signature.dateFieldId)?.type !== 'date')
    fail('Signature date reference must name a date field');
  if (form.signature?.nameFieldId && !fields.has(form.signature.nameFieldId))
    fail('Signature name reference does not exist');
  if (new TextEncoder().encode(JSON.stringify(form)).length > 30720)
    fail('Form schema exceeds 30 KB');
});
export type FormSchema = z.infer<typeof FormSchema>;
export const Answer = z.object({
  value: z.string().max(300000),
  status: z.enum(['answered', 'skipped']),
  normalizedFrom: z.string().max(10000).optional(),
  signedBy: z.string().trim().max(150).optional(),
});
export const Answers = z
  .record(id, Answer)
  .refine((a) => Object.keys(a).length <= 150, 'Too many answers');
export type Answers = z.infer<typeof Answers>;
export const UILanguage = z.enum(['en', 'zh-CN', 'es', 'ja']);
export type UILanguage = z.infer<typeof UILanguage>;
export const TurnResult = z.object({
  validation: z.object({
    ok: z.boolean(),
    message: z.string().max(600).optional(),
    normalizedValue: z.string().max(10000).optional(),
  }),
  nextFieldId: id.nullable(),
  question: z.string().max(1000),
  explanation: z.string().max(1500).optional(),
  done: z.boolean(),
});
export type TurnResult = z.infer<typeof TurnResult>;
export const TurnInput = z.object({
  schema: FormSchema,
  answers: Answers,
  currentFieldId: id,
  action: z.enum(['answer', 'skip', 'back', 'explain', 'jump']),
  input: z.string().max(300000).optional(),
  targetFieldId: id.optional(),
  uiLanguage: UILanguage,
  confirmed: z.boolean().optional(),
  questionOnly: z.boolean().optional(),
  signedBy: z.string().trim().max(150).optional(),
});
export type TurnInput = z.infer<typeof TurnInput>;
export const FinalizeInput = z.object({
  schema: FormSchema,
  answers: Answers,
  demoSlug: z.enum(['change-of-address', 'insurance-claim', 'medical-release']).optional(),
  signaturePng: z.string().max(300000).optional(),
  uiLanguage: UILanguage,
  lock: z.boolean().default(false),
});
export const Session = z.object({
  id: z.string().uuid(),
  schema: FormSchema,
  answers: Answers,
  currentFieldId: id.nullable(),
  uiLanguage: UILanguage,
  state: z.enum(['asking', 'reviewing']),
  fileName: z.string().max(255),
  createdAt: z.number(),
  demoSlug: z.enum(['change-of-address', 'insurance-claim', 'medical-release']).optional(),
});
export type Session = z.infer<typeof Session>;
