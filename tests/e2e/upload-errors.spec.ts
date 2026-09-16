import { expect, test } from '@playwright/test';

test('upload processing failures stay localized and permit retry or switching to a demo', async ({
  page,
}) => {
  const failures = [
    { status: 502, code: 'llm_error', text: '读取表格超时了，请重试。' },
    { status: 422, code: 'llm_blocked', text: '这份表格有内容无法处理，请去掉敏感页后再试。' },
    { status: 422, code: 'schema_empty', text: '没有在这个文件里找到可填写的字段。' },
    { status: 429, code: 'rate_limited', text: '免费额度已用完' },
  ];
  let requestCount = 0;
  await page.route('**/api/extract', async (route) => {
    const failure = failures[requestCount++];
    await route.fulfill({
      status: failure.status,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: failure.code, message: 'English server fallback' } }),
    });
  });
  await page.goto('/');
  test.skip(
    (await page.locator('input[type=file]').count()) === 0,
    'Live uploads are disabled in this deployment.',
  );
  await page.getByRole('combobox', { name: 'Language' }).selectOption('zh-CN');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles('public/demo-forms/change-of-address.pdf');
  for (let index = 0; index < failures.length; index++) {
    await expect(page.locator('.upload-panel [role=alert]')).toContainText(failures[index].text);
    await expect(page.locator('.upload-panel [role=alert]')).not.toContainText(
      'English server fallback',
    );
    if (index + 1 < failures.length)
      await page.getByRole('button', { name: '重试', exact: true }).click();
  }
  expect(requestCount).toBe(4);
  await page.getByTestId('demo-insurance-claim').click();
  await expect(page).toHaveURL(/\/fill\//);
});
