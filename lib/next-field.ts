import type { Answers, Field, FormSchema } from './schema';
export function isActive(
  field: Field,
  schema: FormSchema,
  answers: Answers,
  seen = new Set<string>(),
): boolean {
  if (!field.dependsOn) return true;
  if (seen.has(field.id)) return false;
  seen.add(field.id);
  const parent = schema.fields.find((f) => f.id === field.dependsOn!.fieldId);
  const answer = answers[field.dependsOn.fieldId];
  return (
    !!parent &&
    isActive(parent, schema, answers, seen) &&
    answer?.status === 'answered' &&
    answer.value === field.dependsOn.equals
  );
}
export function orderedFields(schema: FormSchema) {
  const map = new Map(schema.fields.map((f) => [f.id, f]));
  return schema.sections.flatMap((s) => s.fieldIds.map((id) => map.get(id)!)).filter(Boolean);
}
export const activeFields = (schema: FormSchema, answers: Answers) =>
  orderedFields(schema).filter((field) => isActive(field, schema, answers));
export function pruneAnswers(schema: FormSchema, answers: Answers): Answers {
  return Object.fromEntries(
    Object.entries(answers).filter(([id]) => {
      const field = schema.fields.find((f) => f.id === id);
      return field && isActive(field, schema, answers);
    }),
  );
}
export function nextField(
  schema: FormSchema,
  answers: Answers,
  current: string,
  action: 'answer' | 'skip' | 'back' | 'jump' | 'explain',
  target?: string,
): string | null {
  const fields = activeFields(schema, answers);
  const index = fields.findIndex((f) => f.id === current);
  if (action === 'jump') {
    if (!fields.some((f) => f.id === target)) throw new Error('This question is not available.');
    return target!;
  }
  if (action === 'explain') return fields.some((f) => f.id === current) ? current : null;
  if (action === 'back') return fields[Math.max(0, index - 1)]?.id ?? null;
  const candidates = [...fields.slice(index + 1), ...fields.slice(0, Math.max(0, index))];
  return candidates.find((f) => !answers[f.id])?.id ?? null;
}
export function applyAnswer(
  schema: FormSchema,
  answers: Answers,
  fieldId: string,
  value: string,
  status: 'answered' | 'skipped' = 'answered',
): Answers {
  const field = schema.fields.find((f) => f.id === fieldId);
  if (!field || !isActive(field, schema, answers))
    throw new Error('This question is not available.');
  return pruneAnswers(schema, { ...answers, [fieldId]: { value, status } });
}
