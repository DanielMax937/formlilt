import type { FormSchema, Field, Answers } from '@/lib/schema';
import { isActive, orderedFields } from '@/lib/next-field';
export function fixtureValue(field: Field, png: string): string {
  if (field.type === 'signature') return png;
  if (field.type === 'date') return '2026-09-16';
  if (field.type === 'email') return 'alex@example.com';
  if (field.type === 'phone') return '2025550142';
  if (field.type === 'checkbox') return 'false';
  if (field.type === 'select')
    return field.options!.find((v) => /^no(?:\s|$)/i.test(v)) ?? field.options![0];
  if (field.type === 'multiselect') return JSON.stringify([field.options![0]]);
  if (field.type === 'number') return String(field.constraints?.min ?? 1);
  const label = field.label.toLowerCase();
  let value = /zip|postal/.test(label)
    ? '43016'
    : /state|province/.test(label)
      ? 'OH'
      : /city/.test(label)
        ? 'Dublin'
        : /country/.test(label)
          ? 'USA'
          : /street|address/.test(label)
            ? '123 Example Street'
            : /first name/.test(label)
              ? 'Alex'
              : /last name/.test(label)
                ? 'Rivera'
                : /middle|initial/.test(label)
                  ? 'J'
                  : /name/.test(label)
                    ? 'Alex Rivera'
                    : /sex/.test(label)
                      ? 'X'
                      : /social security/.test(label)
                        ? '000-00-0000'
                        : /number|\bid\b/.test(label)
                          ? '123456789'
                          : 'Example';
  return value.slice(0, field.constraints?.maxLength ?? 10000);
}
export function fixtureAnswers(schema: FormSchema, png: string, all = false) {
  let answers: Answers = {};
  for (const field of orderedFields(schema)) {
    if (!isActive(field, schema, answers)) continue;
    answers[field.id] =
      !field.required && !all
        ? { status: 'skipped', value: '' }
        : {
            status: 'answered',
            value: fixtureValue(field, png),
            ...(field.type === 'signature' ? { signedBy: 'Alex Rivera' } : {}),
          };
  }
  return answers;
}
