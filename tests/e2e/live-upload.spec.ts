import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { PDFDocument, PDFTextField } from 'pdf-lib';
import { fixtureValue } from '../fixtures/answers';
import { FormSchema, type Session } from '../../lib/schema';

// Opt in: these cases send public blank PDFs to the configured model and consume quota.
// Run each case against a fresh local production server to isolate the daily/hourly limits.
test.skip(process.env.RUN_LIVE_UPLOAD !== '1', 'Requires an explicitly enabled live model run.');

for (const slug of ['change-of-address', 'insurance-claim', 'medical-release']) {
  test(`${slug}: live upload, extraction, questions, signature and PDF download`, async ({
    page,
  }, info) => {
    test.setTimeout(420000);
    const errors: string[] = [];
    const apiResponses: { path: string; status: number }[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (path.startsWith('/api/')) {
        apiResponses.push({ path, status: response.status() });
        if (!response.ok()) errors.push(`${response.status()} ${path}`);
      }
    });
    await page.goto('/');
    await expect(page.locator('input[type=file]').first()).toBeAttached();
    await page.getByRole('combobox', { name: 'Language' }).selectOption('en');

    const startedAt = new Date().toISOString();
    const started = performance.now();
    const extractionResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/extract',
      { timeout: 330000 },
    );
    await page.locator('input[type=file]').first().setInputFiles(`public/demo-forms/${slug}.pdf`);
    const response = await extractionResponse;
    const extraction = await response.json();
    const extractionSeconds = Number(((performance.now() - started) / 1000).toFixed(3));
    await writeFile(info.outputPath('extract-response.json'), JSON.stringify(extraction, null, 2));
    await writeFile(
      info.outputPath('extract-evidence.json'),
      JSON.stringify(
        {
          slug,
          project: info.project.name,
          startedAt,
          extractionSeconds,
          status: response.status(),
          mocked: false,
          apiResponses,
        },
        null,
        2,
      ),
    );
    expect(response.status(), JSON.stringify(extraction.error)).toBe(200);
    const schema = FormSchema.parse(extraction.schema);
    const inventory = { 'change-of-address': 31, 'insurance-claim': 42, 'medical-release': 103 };
    expect(schema.fields.length).toBeGreaterThanOrEqual(
      Math.ceil(inventory[slug as keyof typeof inventory] * 0.9),
    );
    await expect(page).toHaveURL(/\/fill\//);

    const readSession = (): Promise<Session> =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((item) => item.startsWith('fillflow:session:'));
        if (!key) throw new Error('Uploaded session was not persisted.');
        return JSON.parse(localStorage.getItem(key)!);
      });
    const uploaded = await readSession();
    expect(uploaded.demoSlug).toBeUndefined();
    expect(uploaded.fileName).toBe(slug + '.pdf');
    expect(uploaded.schema).toEqual(schema);

    let signatures = 0;
    for (let step = 0; step < 160; step++) {
      const session = await readSession();
      if (session.state === 'reviewing') break;
      const field = session.schema.fields.find((item) => item.id === session.currentFieldId);
      expect(field).toBeDefined();
      if (!field) throw new Error('Current question is missing from extracted schema.');
      await expect(page.getByTestId('todo-' + field.id)).toHaveAttribute('data-status', 'current');
      if (!field.required && field.type !== 'signature') {
        await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
      } else {
        const value = fixtureValue(field, '');
        if (field.type === 'signature') {
          await page.getByRole('button', { name: 'Type instead' }).click();
          await page.getByLabel('Full name of the person signing').fill('Alex Rivera');
          signatures++;
        } else if (field.type === 'select') {
          await page.locator('#answer-input').selectOption(value);
        } else if (field.type === 'multiselect') {
          await page.locator('.choice-list input').first().check();
        } else if (field.type === 'checkbox') {
          await page.getByRole('radio', { name: 'No', exact: true }).check();
        } else {
          await page.locator('#answer-input').fill(value);
        }
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
      }
      await expect.poll(async () => (await readSession()).currentFieldId).not.toBe(field.id);
    }
    await expect(page).toHaveURL(/\/review\//);
    await expect(page.locator('.required-notice')).toHaveCount(0);
    expect(signatures).toBeGreaterThan(0);
    const finalSession = await readSession();
    const download = page.waitForEvent('download', { timeout: 45000 });
    await page.getByRole('button', { name: 'Download filled PDF', exact: true }).click();
    const destination = info.outputPath(slug + '-live-filled.pdf');
    await (await download).saveAs(destination);
    const original = await PDFDocument.load(await readFile(`public/demo-forms/${slug}.pdf`));
    const exported = await PDFDocument.load(await readFile(destination));
    expect(exported.getPageCount()).toBe(original.getPageCount());
    expect(exported.getPages().map((page) => page.getSize())).toEqual(
      original.getPages().map((page) => page.getSize()),
    );
    let checkedNativeTextFields = 0;
    for (const field of schema.fields) {
      const answer = finalSession.answers[field.id];
      if (!field.acroName || answer?.status !== 'answered' || field.type === 'signature') continue;
      const native = exported.getForm().getField(field.acroName);
      if (native instanceof PDFTextField) {
        let expected = answer.value;
        if (field.type === 'date') {
          expect(answer.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          const [year, month, day] = answer.value.split('-');
          if (field.constraints?.dateFormat === 'DD/MM/YYYY') expected = `${day}/${month}/${year}`;
          else if (field.constraints?.dateFormat !== 'YYYY-MM-DD')
            expected = `${month}/${day}/${year}`;
        }
        expect(native.getText()).toBe(expected);
        checkedNativeTextFields++;
      }
    }
    if (slug !== 'medical-release') expect(checkedNativeTextFields).toBeGreaterThan(0);
    await expect(
      page.getByRole('heading', { name: 'Check the filled PDF', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.document-preview img')).toHaveCount(original.getPageCount());
    expect(apiResponses.filter((response) => response.path.startsWith('/api/demo/'))).toEqual([]);
    expect(errors).toEqual([]);
    await writeFile(
      info.outputPath('live-upload-evidence.json'),
      JSON.stringify(
        {
          slug,
          project: info.project.name,
          startedAt,
          extractionSeconds,
          totalSeconds: Number(((performance.now() - started) / 1000).toFixed(3)),
          fields: schema.fields.length,
          signatures,
          checkedNativeTextFields,
          pages: exported.getPageCount(),
          answers: finalSession.answers,
          mocked: false,
          apiResponses,
          errors,
        },
        null,
        2,
      ),
    );
  });
}
