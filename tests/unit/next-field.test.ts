import { expect, test } from 'vitest';
import { FormSchema } from '@/lib/schema';
import { activeFields, applyAnswer, nextField, pruneAnswers } from '@/lib/next-field';
import { sample } from '../fixtures/form';
const schema = FormSchema.parse({
  ...sample,
  sections: [{ id: 'personal', title: 'P', fieldIds: ['a', 'b', 'c', 'd'] }],
  fields: ['a', 'b', 'c', 'd'].map((id) => ({
    ...sample.fields[0],
    id,
    ...(id === 'c' ? { dependsOn: { fieldId: 'a', equals: 'yes' } } : {}),
  })),
});
test('answers advance in section order and skipped fields wait for review', () => {
  let answers = applyAnswer(schema, {}, 'a', 'no');
  expect(nextField(schema, answers, 'a', 'answer')).toBe('b');
  answers = applyAnswer(schema, answers, 'b', '', 'skipped');
  expect(nextField(schema, answers, 'b', 'skip')).toBe('d');
  answers = applyAnswer(schema, answers, 'd', 'end');
  expect(nextField(schema, answers, 'd', 'answer')).toBeNull();
});
test('back and jump can revisit answered or skipped fields', () => {
  const answers = applyAnswer(schema, {}, 'a', 'yes');
  expect(nextField(schema, answers, 'c', 'back')).toBe('b');
  expect(nextField(schema, answers, 'd', 'jump', 'a')).toBe('a');
  expect(nextField(schema, answers, 'a', 'back')).toBe('a');
});
test('dependency changes clear stale values and reject inactive jumps', () => {
  let answers = applyAnswer(schema, {}, 'a', 'yes');
  answers = applyAnswer(schema, answers, 'c', 'dependent');
  expect(activeFields(schema, answers)).toHaveLength(4);
  answers = applyAnswer(schema, answers, 'a', 'no');
  expect(answers.c).toBeUndefined();
  expect(activeFields(schema, answers)).toHaveLength(3);
  expect(() => nextField(schema, answers, 'a', 'jump', 'c')).toThrow();
  expect(
    pruneAnswers(schema, { ...answers, unknown: { value: 'x', status: 'answered' } }).unknown,
  ).toBeUndefined();
});
