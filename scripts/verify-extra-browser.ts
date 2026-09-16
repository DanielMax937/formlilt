import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
import { FormSchema, type Session, type UILanguage } from '../lib/schema';
import { t } from '../lib/i18n';
import { formatDate } from '../lib/validate';

async function main() {
  if (process.env.RUN_LIVE_UPLOAD !== '1')
    throw new Error(
      'Set RUN_LIVE_UPLOAD=1 to send a public blank fixture to the configured model.',
    );
  const name = process.argv[2];
  const language = (process.argv[3] || 'en') as UILanguage;
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid fixture name');
  const root = `tmp/extra-browser/${name}`;
  await mkdir('tmp/extra-browser', { recursive: true });
  // Preserve previous attempts; archive an existing run before deliberately repeating it.
  await mkdir(root);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 950 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const errors: string[] = [];
  const requests: { path: string; status: number }[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('response', (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith('/api/')) requests.push({ path, status: r.status() });
  });
  const evidence: Record<string, unknown> = {
    name,
    startedAt: new Date().toISOString(),
    buildId: (await readFile('.next/BUILD_ID', 'utf8')).trim(),
    mocked: false,
    language,
  };
  const save = async () =>
    writeFile(root + '/evidence.json', JSON.stringify({ ...evidence, requests, errors }, null, 2));
  try {
    await page.goto('http://127.0.0.1:3051/');
    await page.locator('header select').selectOption(language);
    const started = performance.now();
    const responsePromise = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/extract',
      { timeout: 330000 },
    );
    await page.locator('input[type=file]').first().setInputFiles(`tmp/${name}.pdf`);
    const response = await responsePromise;
    const extraction = await response.json();
    evidence.extractionSeconds = Number(((performance.now() - started) / 1000).toFixed(3));
    evidence.extractionStatus = response.status();
    await writeFile(root + '/extract-response.json', JSON.stringify(extraction, null, 2));
    expect(response.status(), JSON.stringify(extraction)).toBe(200);
    const schema = FormSchema.parse(extraction.schema);
    evidence.fields = schema.fields.length;
    evidence.formLanguage = schema.language;
    await expect(page).toHaveURL(/\/fill\//);
    const schemaJson = JSON.stringify(schema, null, 2);
    const schemaSha256 = createHash('sha256').update(schemaJson).digest('hex');
    evidence.schemaSha256 = schemaSha256;
    await writeFile(root + '/schema.json', schemaJson);
    await page.screenshot({ path: root + '/first-question.png', fullPage: true });
    evidence.phase = 'waiting for manually reviewed synthetic answers';
    await save();
    console.log(JSON.stringify(evidence));
    // The operator inspects the source and actual returned schema before writing this file.
    const answerFile = root + '/manual-answers.json';
    const deadline = Date.now() + 20 * 60 * 1000;
    while (true) {
      try {
        await access(answerFile);
        break;
      } catch {}
      if (Date.now() > deadline)
        throw new Error('Manual fixture was not supplied within 20 minutes');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const manual = JSON.parse(await readFile(answerFile, 'utf8')) as {
      schemaSha256: string;
      answers: Record<string, { value: string; signedBy?: string } | null>;
    };
    expect(manual.schemaSha256, 'Manual answers must match this actual extraction').toBe(
      schemaSha256,
    );
    const answers = manual.answers;
    const session = (): Promise<Session> =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((k) => k.startsWith('fillflow:session:'));
        if (!key) throw new Error('No actual uploaded session');
        return JSON.parse(localStorage.getItem(key)!);
      });
    let steps = 0;
    for (; steps < 160; steps++) {
      const current = await session();
      if (current.state === 'reviewing') break;
      const field = schema.fields.find((f) => f.id === current.currentFieldId)!;
      if (!Object.hasOwn(answers, field.id)) throw new Error('Manual fixture missing ' + field.id);
      await expect(page.getByTestId('todo-' + field.id)).toHaveAttribute('data-status', 'current');
      const answer = answers[field.id];
      if (answer === null) {
        await page.getByRole('button', { name: t(language, 'skip'), exact: true }).click();
      } else {
        if (field.type === 'signature') {
          await page
            .getByRole('button', { name: t(language, 'typeSignature'), exact: true })
            .click();
          await page.locator('#signature-name').fill(answer.signedBy || answer.value);
        } else if (field.type === 'checkbox') {
          await page.locator(`input[type=radio][value="${answer.value}"]`).check();
        } else if (field.type === 'select') {
          await page.locator('#answer-input').selectOption(answer.value);
        } else if (field.type === 'multiselect') {
          for (const option of JSON.parse(answer.value))
            await page.getByLabel(option, { exact: true }).check();
        } else await page.locator('#answer-input').fill(answer.value);
        await page.locator('.answer-buttons button.primary').click();
      }
      await expect
        .poll(async () => (await session()).currentFieldId, { timeout: 45000 })
        .not.toBe(field.id);
    }
    await expect(page).toHaveURL(/\/review\//);
    await expect(page.locator('.required-notice')).toHaveCount(0);
    const final = await session();
    expect(
      Object.values(final.answers).filter((a) => a.status === 'answered').length,
    ).toBeGreaterThan(0);
    await writeFile(root + '/session.json', JSON.stringify(final, null, 2));
    const download = page.waitForEvent('download', { timeout: 45000 });
    await page.getByRole('button', { name: t(language, 'download'), exact: true }).click();
    await (await download).saveAs(root + '/filled.pdf');
    const sourceBytes = await readFile(`tmp/${name}.pdf`);
    const outputBytes = await readFile(root + '/filled.pdf');
    const source = await PDFDocument.load(sourceBytes);
    const output = await PDFDocument.load(outputBytes);
    expect(output.getPageCount()).toBe(source.getPageCount());
    expect(output.getPages().map((p) => p.getSize())).toEqual(
      source.getPages().map((p) => p.getSize()),
    );
    let textFields = 0,
      checkboxes = 0;
    for (const field of schema.fields) {
      const answer = final.answers[field.id];
      if (!field.acroName || answer?.status !== 'answered' || field.type === 'signature') continue;
      const native = output.getForm().getField(field.acroName);
      if (native instanceof PDFTextField) {
        expect(native.getText()).toBe(
          field.type === 'date'
            ? formatDate(answer.value, field.constraints?.dateFormat)
            : answer.value,
        );
        textFields++;
      } else if (native instanceof PDFCheckBox) {
        expect(native.isChecked()).toBe(answer.value === 'true');
        checkboxes++;
      }
    }
    await expect(page.locator('.document-preview img')).toHaveCount(source.getPageCount());
    await page.screenshot({ path: root + '/review.png', fullPage: true });
    expect(requests.some((r) => r.path.startsWith('/api/demo/'))).toBe(false);
    expect(requests.filter((r) => r.status >= 400)).toEqual([]);
    expect(errors).toEqual([]);
    Object.assign(evidence, {
      phase: 'exported; visual review pending',
      steps,
      answeredFields: Object.values(final.answers).filter((a) => a.status === 'answered').length,
      pages: output.getPageCount(),
      nativeTextFields: textFields,
      nativeCheckboxes: checkboxes,
      sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
      exportSha256: createHash('sha256').update(outputBytes).digest('hex'),
    });
  } catch (error) {
    evidence.phase = 'failed';
    evidence.error = error instanceof Error ? error.message : String(error);
    await page.screenshot({ path: root + '/failure.png', fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    evidence.finishedAt = new Date().toISOString();
    await save();
    console.log(JSON.stringify(evidence));
    await context.tracing.stop({ path: root + '/trace.zip' });
    await browser.close();
  }
}
void main();
