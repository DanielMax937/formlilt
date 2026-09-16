import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('home, workspace, signature, review and privacy have no WCAG A/AA violations', async ({
  page,
}) => {
  test.setTimeout(120000);
  const audit = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, issue: n.failureSummary })),
      })),
    ).toEqual([]);
  };
  await page.goto('/');
  await audit();
  await page.getByTestId('demo-insurance-claim').click();
  await expect(page).toHaveURL(/\/fill\//);
  await audit();
  await page.getByTestId('todo-f30').click();
  await audit();
  await page.getByRole('link', { name: 'Review answers' }).click();
  await expect(page).toHaveURL(/\/review\//);
  await expect(
    page.getByRole('heading', { name: 'A final look, then you’re done.' }),
  ).toBeVisible();
  await audit();
  await page.getByRole('link', { name: 'Start another form' }).click();
  await page.locator('footer').getByRole('link', { name: 'Privacy & about' }).click();
  await expect(page.getByRole('heading', { name: 'Your form. Your choices.' })).toBeVisible();
  await audit();
});
test('demo questions switch language immediately without model requests', async ({ page }) => {
  const turns: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/turn')) turns.push(request.url());
  });
  await page.goto('/');
  await page.getByTestId('demo-insurance-claim').click();
  await expect(page).toHaveURL(/\/fill\//);
  await page.getByLabel('Language', { exact: true }).selectOption('zh-CN');
  await expect(page.locator('#question-heading')).toHaveText('患者的姓氏是什么？');
  expect(turns).toEqual([]);
  await page.reload();
  await expect(page.locator('#question-heading')).toHaveText('患者的姓氏是什么？');
});
