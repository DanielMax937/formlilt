import { expect, test } from '@playwright/test';
test('local details are opt-in suggestions and clear-all removes them', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Save details for your next form', { exact: true }).click();
  await expect(page.getByLabel('Full name', { exact: true })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('fillflow:profile'))).toBeNull();
  await page.getByLabel('Remember my details on this device').check();
  await page.getByLabel('Full name', { exact: true }).fill('Alex Rivera');
  await page.getByLabel('Current address', { exact: true }).fill('123 Example Street');
  await page.getByLabel('Identity document number', { exact: true }).fill('000-00-0000');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await page.getByTestId('demo-change-of-address').click();
  await expect(page).toHaveURL(/\/fill\//);
  await page.getByTestId('todo-f5').click();
  await expect(page.locator('#answer-input')).toHaveValue('');
  await page.getByRole('button', { name: 'Use saved detail: Alex Rivera' }).click();
  await expect(page.locator('#answer-input')).toHaveValue('Alex Rivera');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.reload();
  await page.getByTestId('todo-f19').click();
  await page.getByRole('button', { name: 'Use saved detail: 123 Example Street' }).click();
  await expect(page.locator('#answer-input')).toHaveValue('123 Example Street');
  await page.getByRole('link', { name: /FormLilt/ }).click();
  await page.locator('footer').getByRole('link', { name: 'Privacy & about' }).click();
  await expect(page).toHaveURL(/\/about/);
  await page.getByRole('button', { name: 'Clear all saved forms' }).click();
  await expect(page.getByRole('status')).toContainText('cleared');
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('fillflow:'))),
  ).toEqual([]);
});
