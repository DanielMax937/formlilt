import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { extractForm } from '../lib/extract-form';
import { Answers, FormSchema } from '../lib/schema';
import { parseDocument } from '../lib/pdf-extract';
import { fillPdf } from '../lib/fill-pdf';
import { fixtureAnswers } from '../tests/fixtures/answers';
import { invalidFields } from '../lib/validate';
async function main() {
  const names = process.argv.slice(2);
  if (process.env.BENCH_ANSWERS_FILE && names.length !== 1)
    throw new Error('Use one source at a time with BENCH_ANSWERS_FILE.');
  await mkdir('tmp/extra-pages', { recursive: true });
  await mkdir('tmp/extra-results', { recursive: true });
  const png =
    'data:image/png;base64,' + (await readFile('tests/fixtures/signature.png')).toString('base64');
  for (const name of names) {
    const tag = process.env.BENCH_TAG;
    if (tag && !/^[a-zA-Z0-9_-]+$/.test(tag)) throw new Error('Invalid BENCH_TAG.');
    const outputName = tag ? `${name}.${tag}` : name;
    const evidence: Record<string, unknown> = {
      name,
      model: process.env.AGENT_IM_MODEL ?? 'codex-login/gpt-6-astra',
      startedAt: new Date().toISOString(),
    };
    try {
      const bytes = new Uint8Array(await readFile(`tmp/${name}.pdf`));
      evidence.sourceSha256 = createHash('sha256').update(bytes).digest('hex');
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
        if (process.env.FORCE_EXTRACT === '1') throw new Error('Live extraction requested.');
        schema = FormSchema.parse(
          JSON.parse(await readFile(`tmp/extra-results/${outputName}.schema.json`, 'utf8')),
        );
        evidence.schemaSource = 'cache';
      } catch {
        evidence.schemaSource = 'live-model';
        try {
          schema = await extractForm(bytes, images);
        } finally {
          evidence.seconds = Number(((performance.now() - start) / 1000).toFixed(3));
        }
      }
      evidence.seconds ??= Number(((performance.now() - start) / 1000).toFixed(3));
      evidence.fields = schema.fields.length;
      evidence.language = schema.language;
      await writeFile(
        `tmp/extra-results/${outputName}.schema.json`,
        JSON.stringify(schema, null, 2),
      );
      const answers = process.env.BENCH_ANSWERS_FILE
        ? Answers.parse(JSON.parse(await readFile(process.env.BENCH_ANSWERS_FILE, 'utf8')))
        : fixtureAnswers(schema, png, true);
      evidence.answeredFields = Object.values(answers).filter(
        (answer) => answer.status === 'answered' && answer.value,
      ).length;
      if (!evidence.answeredFields) throw new Error('The sample did not fill any fields.');
      await writeFile(
        `tmp/extra-results/${outputName}.answers.json`,
        JSON.stringify(answers, null, 2),
      );
      evidence.invalidSampleAnswers = invalidFields(schema, answers);
      const output = await fillPdf(bytes, schema, answers);
      await writeFile(`tmp/extra-results/${outputName}-filled.pdf`, output);
      evidence.exportSha256 = createHash('sha256').update(output).digest('hex');
      evidence.exportBytes = output.length;
      evidence.exportPages = (await parseDocument(output)).pages.length;
      evidence.result = 'exported; visual review pending';
    } catch (error) {
      evidence.result = 'failed';
      evidence.error =
        error && typeof error === 'object' && 'code' in error
          ? {
              code: error.code,
              status: 'status' in error ? error.status : undefined,
              message: 'message' in error ? error.message : undefined,
            }
          : error instanceof Error
            ? error.message
            : String(error);
      process.exitCode = 1;
    }
    evidence.finishedAt = new Date().toISOString();
    await writeFile(
      `tmp/extra-results/${outputName}.evidence.json`,
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence));
  }
}
void main();
