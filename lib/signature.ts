import type { Answers, Field, FormSchema } from './schema';
import { today } from './validate';
/** Associate the image with its signer; only the explicitly linked date is automatic. */
export function attachSignature(
  schema: FormSchema,
  answers: Answers,
  field: Field,
  signedBy?: string,
  date = today(),
): Answers {
  if (
    field.type !== 'signature' ||
    answers[field.id]?.status !== 'answered' ||
    !answers[field.id].value
  )
    return answers;
  const result = { ...answers, [field.id]: { ...answers[field.id], signedBy: signedBy?.trim() } };
  const dateId = schema.signature?.fieldId === field.id ? schema.signature.dateFieldId : undefined;
  if (dateId && !result[dateId]?.value) result[dateId] = { status: 'answered', value: date };
  return result;
}
