import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { FormSchema } from './schema';
let known: Promise<Set<string>> | undefined;
const digest = (schema: FormSchema) =>
  createHash('sha256')
    .update(JSON.stringify(FormSchema.parse(schema)))
    .digest('hex');
/** A client-supplied slug is never enough to bypass a quota. Compare the complete schema. */
export async function isKnownDemo(schema: FormSchema) {
  known ??= Promise.all(
    ['change-of-address', 'insurance-claim', 'medical-release'].map(async (slug) =>
      digest(
        FormSchema.parse(
          JSON.parse(
            await readFile(
              path.join(process.cwd(), 'public', 'demo-forms', slug + '.schema.json'),
              'utf8',
            ),
          ),
        ),
      ),
    ),
  ).then((items) => new Set(items));
  return (await known).has(digest(schema));
}

/** Retrieve only a checked-in PDF whose complete schema matches the supplied demo. */
export async function demoOriginal(slug: string, schema: FormSchema): Promise<Uint8Array> {
  if (!['change-of-address', 'insurance-claim', 'medical-release'].includes(slug))
    throw new Error('Unknown demo.');
  const folder = path.join(process.cwd(), 'public', 'demo-forms');
  const expected = FormSchema.parse(
    JSON.parse(await readFile(path.join(folder, slug + '.schema.json'), 'utf8')),
  );
  if (digest(schema) !== digest(expected)) throw new Error('The demo schema does not match.');
  return new Uint8Array(await readFile(path.join(folder, slug + '.pdf')));
}
