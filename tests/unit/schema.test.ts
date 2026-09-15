import { expect, test } from 'vitest';
import { FormSchema, TurnInput } from '@/lib/schema';
import { sample } from '../fixtures/form';
test('accepts a valid form and rejects duplicate/dangling field references', () => {
  expect(FormSchema.safeParse(sample).success).toBe(true);
  expect(FormSchema.safeParse({ ...sample, fields: [...sample.fields,...sample.fields] }).success).toBe(false);
  expect(FormSchema.safeParse({ ...sample, sections: [{ id: 'personal', title: 'P', fieldIds: ['missing'] }] }).success).toBe(false);
});
test('rejects out-of-page anchors, inverted boxes, cyclic dependencies and missing options', () => {
  for (const change of [{ anchor: { page: 1, placement: 'below' } }, { anchor: { page: 0, placement: 'inbox', bbox: [.8,.1,.2,.3] } }, { dependsOn: { fieldId: 'name', equals: 'yes' } }, { type: 'select', options: [] }]) expect(FormSchema.safeParse({ ...sample, fields: [{ ...sample.fields[0], ...change }] }).success).toBe(false);
});
test('validates turn actions and language at API boundaries', () => {
  expect(TurnInput.safeParse({ schema: sample, answers: {}, currentFieldId: 'name', action: 'delete', uiLanguage: 'en' }).success).toBe(false);
});
