import { expect, test } from 'vitest';
import { Field } from '@/lib/schema';
import { validate, dateParts, formatDate } from '@/lib/validate';
const base = { id: 'test', label: 'Test', section: 's', required: true };
const field = (type: string, constraints?: unknown) =>
  Field.parse({
    ...base,
    type,
    constraints,
    ...(type === 'select' || type === 'multiselect' ? { options: ['A', 'B'] } : {}),
  });
test('validates calendar dates including leap years and day-first formatting', () => {
  expect(validate(field('date'), '2024-02-29').ok).toBe(true);
  expect(validate(field('date'), '2025-02-29').ok).toBe(false);
  expect(dateParts('04/31/2026')).toBeNull();
  expect(formatDate('2026-09-16', 'DD/MM/YYYY')).toBe('16/09/2026');
});
test('rejects bad email, telephone, numeric, enum and long values', () => {
  for (const [f, value] of [
    [field('email'), 'invalid'],
    [field('phone'), '123'],
    [field('number', { min: 1, max: 10 }), '11'],
    [field('select'), 'C'],
    [field('multiselect'), '["A","C"]'],
    [field('text', { maxLength: 3 }), 'abcd'],
  ] as const)
    expect(validate(f, value).ok).toBe(false);
  expect(validate(field('number'), '-0.3').ok).toBe(true);
  expect(validate(field('phone'), '+1 (555) 010-2345').ok).toBe(true);
});
test('regex matching cannot cause catastrophic backtracking', () => {
  const start = performance.now();
  expect(validate(field('text', { pattern: '^(a+)+$' }), 'a'.repeat(3000) + '!').ok).toBe(false);
  expect(performance.now() - start).toBeLessThan(1500);
});
test('required checkbox false remains a real answer; empty optional values are valid', () => {
  expect(validate(field('checkbox'), 'false').ok).toBe(true);
  expect(validate(field('text'), '').ok).toBe(false);
  expect(validate({ ...field('text'), required: false }, '').ok).toBe(true);
});
