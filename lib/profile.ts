import { z } from 'zod';
import type { Field } from './schema';
const key = 'fillflow:profile';
export const Profile = z.object({
  enabled: z.boolean(),
  name: z.string().trim().max(150),
  address: z.string().trim().max(300),
  idNumber: z.string().trim().max(60),
});
export type Profile = z.infer<typeof Profile>;
export function loadProfile(): Profile | null {
  try {
    const value = Profile.safeParse(JSON.parse(localStorage.getItem(key) || 'null'));
    return value.success && value.data.enabled ? value.data : null;
  } catch {
    return null;
  }
}
export function saveProfile(profile: Profile) {
  const parsed = Profile.parse(profile);
  if (parsed.enabled) localStorage.setItem(key, JSON.stringify(parsed));
  else localStorage.removeItem(key);
}
export function profileSlot(field: Field): 'name' | 'address' | 'idNumber' | null {
  if (!['text', 'textarea'].includes(field.type)) return null;
  const label = field.label.toLowerCase();
  // Avoid guessing a relative's name, splitting names, or confusing policy numbers with IDs.
  if (
    /parent|mother|father|spouse|employer|guardian|prescriber|doctor|父|母|配偶|監護|保護者/.test(
      label,
    )
  )
    return null;
  if (
    /^(your |applicant'?s? |patient'?s? |student'?s? |full )?name\b|full name|姓名|氏名|nombre completo|nom complet/i.test(
      label,
    ) &&
    !/first|last|middle|company/.test(label)
  )
    return 'name';
  if (
    /^(new |your |home |mailing |current |residential |street )?address\b|现住址|新地址|住所|dirección|adresse/i.test(
      label,
    ) &&
    !/old|previous|employer|insurance/.test(label)
  )
    return 'address';
  if (
    /social security number|national (id|identification)|passport number|证件号|身份证|旅券番号|número de (identidad|pasaporte)/i.test(
      label,
    )
  )
    return 'idNumber';
  return null;
}
