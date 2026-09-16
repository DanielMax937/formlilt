import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { fixtureValue } from '../fixtures/answers';
import type { Session } from '../../lib/schema';
for (const slug of ['change-of-address', 'insurance-claim', 'medical-release'])
  test(`${slug}: complete questions, sign, review and download`, async ({ page }, info) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.url().includes('/api/') && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto('/');
    await page.getByTestId('demo-' + slug).click();
    await expect(page).toHaveURL(/\/fill\//);
    for (let step = 0; step < 150; step++) {
      const session: Session = await page.evaluate(() =>
        JSON.parse(
          localStorage.getItem(
            Object.keys(localStorage).find((k) => k.startsWith('fillflow:session:'))!,
          )!,
        ),
      );
      if (session.state === 'reviewing') break;
      const field = session.schema.fields.find((f) => f.id === session.currentFieldId)!;
      await expect(page.getByTestId('todo-' + field.id)).toHaveAttribute('data-status', 'current');
      if (!field.required)
        await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
      else {
        const value = fixtureValue(field, '');
        if (field.type === 'signature') {
          await page.getByRole('button', { name: 'Type instead' }).click();
          await page.getByLabel('Full name of the person signing').fill('Alex Rivera');
        } else if (field.type === 'select') await page.locator('#answer-input').selectOption(value);
        else if (field.type === 'multiselect')
          await page.locator('.choice-list input').first().check();
        else if (field.type === 'checkbox')
          await page.getByRole('radio', { name: 'No', exact: true }).check();
        else await page.locator('#answer-input').fill(value);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
      }
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(
                localStorage.getItem(
                  Object.keys(localStorage).find((k) => k.startsWith('fillflow:session:'))!,
                )!,
              ).currentFieldId,
          ),
        )
        .not.toBe(field.id);
    }
    await expect(page).toHaveURL(/\/review\//);
    await expect(page.locator('.required-notice')).toHaveCount(0);
    const download = page.waitForEvent('download', { timeout: 30000 });
    await page.getByRole('button', { name: 'Download filled PDF', exact: true }).click();
    const file = await download;
    const destination = info.outputPath(slug + '-filled.pdf');
    await file.saveAs(destination);
    const pdf = await PDFDocument.load(await readFile(destination));
    expect(pdf.getPageCount()).toBe(2);
    await expect(
      page.getByRole('heading', { name: 'Check the filled PDF', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.document-preview img')).toHaveCount(2);
    expect(errors).toEqual([]);
  });
