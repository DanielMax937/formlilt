import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseDocument } from '../lib/pdf-extract';
async function main() {
  await mkdir('tmp/documents', { recursive: true });
  for (const slug of ['change-of-address', 'insurance-claim', 'medical-release']) {
    const doc = await parseDocument(
      new Uint8Array(await readFile(`public/demo-forms/${slug}.pdf`)),
    );
    await writeFile(`tmp/documents/${slug}.json`, JSON.stringify(doc, null, 2));
  }
}
main();
