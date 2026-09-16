import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extractForm } from '../lib/extract-form';
import { FormSchema } from '../lib/schema';
import { parseDocument } from '../lib/pdf-extract';
import { fillPdf } from '../lib/fill-pdf';
import { fixtureAnswers } from '../tests/fixtures/answers';
import { invalidFields } from '../lib/validate';
async function main() {
  const names = process.argv.slice(2);
  await mkdir('tmp/extra-pages', { recursive: true });
  await mkdir('tmp/extra-results', { recursive: true });
  const png =
    'data:image/png;base64,' + (await readFile('tests/fixtures/signature.png')).toString('base64');
  for (const name of names) {
    const evidence: Record<string, unknown> = {
      name,
      model: process.env.AGENT_IM_MODEL ?? 'codex-login/gpt-6-astra',
    };
    try {
      const bytes = new Uint8Array(await readFile(`tmp/${name}.pdf`));
      const parsed = await parseDocument(bytes);
      evidence.pages = parsed.pages.length;
      evidence.kinds = parsed.pages.map((p) => p.kind);
      evidence.nativeWidgets = parsed.acroFields.length;
      execFileSync('pdftoppm', [
        '-jpeg',
        '-jpegopt',
        'quality=80',
        '-scale-to',
        '1600',
        `tmp/${name}.pdf`,
        `tmp/extra-pages/${name}`,
      ]);
      const images = await Promise.all(
        (await readdir('tmp/extra-pages'))
          .filter((f) => f.startsWith(name + '-') && f.endsWith('.jpg'))
          .sort()
          .map(async (f) => new Uint8Array(await readFile(`tmp/extra-pages/${f}`))),
      );
      const start = performance.now();
      let schema: FormSchema;
      try {
        schema = FormSchema.parse(
          JSON.parse(await readFile(`tmp/extra-results/${name}.schema.json`, 'utf8')),
        );
      } catch {
        schema = await extractForm(bytes, images);
      }
      evidence.seconds = Math.round((performance.now() - start) / 1000);
      evidence.fields = schema.fields.length;
      evidence.language = schema.language;
      await writeFile(`tmp/extra-results/${name}.schema.json`, JSON.stringify(schema, null, 2));
      const answers = fixtureAnswers(schema, png);
      await writeFile(`tmp/extra-results/${name}.answers.json`, JSON.stringify(answers, null, 2));
      evidence.invalidSampleAnswers = invalidFields(schema, answers);
      const output = await fillPdf(bytes, schema, answers);
      await writeFile(`tmp/extra-results/${name}-filled.pdf`, output);
      evidence.exportBytes = output.length;
      evidence.exportPages = (await parseDocument(output)).pages.length;
      evidence.result = 'exported; visual review pending';
    } catch (error) {
      evidence.result = 'failed';
      evidence.error = error instanceof Error ? error.message : error;
    }
    await writeFile(`tmp/extra-results/${name}.evidence.json`, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
  }
}
void main();
