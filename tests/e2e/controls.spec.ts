import { expect, test } from '@playwright/test';
test('typed controls, dependencies and keyboard navigation work on mobile and desktop', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('demo-insurance-claim').click();
  await expect(page).toHaveURL(/\/fill\//, { timeout: 10000 });
  await page.getByTestId('todo-f9').click();
  await expect(page.locator('#answer-input')).toHaveAttribute('type', 'date');
  await page.locator('#answer-input').fill('1990-04-12');
  await page.locator('#answer-input').press('Tab');
  await page.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
  await page.getByTestId('todo-f12').click();
  await page.locator('#answer-input').selectOption({ label: 'No (proceed to Section III)' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByTestId('todo-f13')).toHaveCount(0);
  await page.getByTestId('todo-f12').click();
  await page
    .locator('#answer-input')
    .selectOption({ label: 'Yes (check type and provide coverage information below)' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByTestId('todo-f13')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'launch/workspace-' + test.info().project.name + '.png',
    fullPage: true,
  });
});
