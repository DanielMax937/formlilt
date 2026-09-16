import { expect, test } from 'vitest';
import { attachSignature } from '@/lib/signature';
import { FormSchema } from '@/lib/schema';
import { validate } from '@/lib/validate';
import raw from '../../public/demo-forms/insurance-claim.schema.json';
const schema = FormSchema.parse(raw);
const field = schema.fields.find((f) => f.type === 'signature')!;
const png = 'data:image/png;base64,' + 'A'.repeat(120);
test('signatures require signer attribution and only auto-fill the linked empty date', () => {
  expect(validate(field, png).ok).toBe(false);
  expect(validate(field, png, {}, 'Alex Rivera').ok).toBe(true);
  const answers = attachSignature(
    schema,
    { [field.id]: { value: png, status: 'answered' } },
    field,
    ' Alex Rivera ',
    '2026-09-16',
  );
  expect(answers[field.id].signedBy).toBe('Alex Rivera');
  expect(answers[schema.signature!.dateFieldId!].value).toBe('2026-09-16');
  const kept = attachSignature(schema, answers, field, 'Alex Rivera', '2026-09-17');
  expect(kept[schema.signature!.dateFieldId!].value).toBe('2026-09-16');
});
