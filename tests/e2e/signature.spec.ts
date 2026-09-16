import { expect, test } from '@playwright/test';
test('keyboard signature stores a PNG, signer and linked current date', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('demo-insurance-claim').click();
  await expect(page).toHaveURL(/\/fill\//);
  await page.getByTestId('todo-f30').click();
  await page.getByRole('button', { name: 'Type instead' }).press('Enter');
  await page.getByLabel('Full name of the person signing').fill('Alex Rivera');
  await page.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
  const data = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        Object.keys(localStorage).find((k) => k.startsWith('fillflow:session:'))!,
      )!,
    ),
  );
  expect(data.answers.f30.value).toMatch(/^data:image\/png;base64,/);
  expect(data.answers.f30.signedBy).toBe('Alex Rivera');
  expect(data.answers.f31.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.getByTestId('todo-f30').click();
  await expect(page.getByLabel('Full name of the person signing')).toHaveValue('Alex Rivera');
  await page.getByRole('button', { name: 'Clear signature', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#answer-error')).toBeVisible();
});
test('pointer strokes create a signature without blocking page scrolling outside the canvas', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('demo-insurance-claim').click();
  await expect(page).toHaveURL(/\/fill\//);
  await page.getByTestId('todo-f30').click();
  await page.getByLabel('Full name of the person signing').fill('Alex Rivera');
  const pad = page.locator('canvas.signature-canvas');
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 35, { steps: 8 });
  await page.mouse.move(box.x + 180, box.y + 70, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByTestId('todo-f30')).toHaveAttribute('data-status', 'completed');
});
