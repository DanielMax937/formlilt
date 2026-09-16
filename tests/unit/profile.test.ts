import { expect, test } from 'vitest';
import { Profile, profileSlot } from '@/lib/profile';
import { Field } from '@/lib/schema';
const field = (label: string) =>
  Field.parse({ id: 'name', label, section: 's', type: 'text', required: false });
test('profile suggestions avoid relatives, split names, old addresses and policy numbers', () => {
  expect(profileSlot(field('Your name'))).toBe('name');
  expect(profileSlot(field('New address'))).toBe('address');
  expect(profileSlot(field('Your social security number'))).toBe('idNumber');
  for (const label of [
    'Spouse name',
    'First name',
    'Mother/guardian name',
    'Your old address',
    'Policy number',
  ])
    expect(profileSlot(field(label))).toBeNull();
});
test('profile values are bounded and cannot carry unrecognized extra properties', () => {
  expect(
    Profile.parse({ enabled: true, name: ' Alex ', address: '', idNumber: '', other: 'discard' }),
  ).toEqual({ enabled: true, name: 'Alex', address: '', idNumber: '' });
  expect(
    Profile.safeParse({ enabled: true, name: 'A'.repeat(151), address: '', idNumber: '' }).success,
  ).toBe(false);
});
