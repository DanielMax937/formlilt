import { expect, test, type Locator, type Page } from '@playwright/test';
import { fixtureValue } from '../fixtures/answers';
import type { Session } from '../../lib/schema';

// Every interaction uses Tab/Shift+Tab, typing and Enter. No mouse or programmatic focus.
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 220; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(
      page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab',
    );
  }
  throw new Error('Control cannot be reached by keyboard');
}
test('keyboard alone completes, signs and downloads the address form', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/');
  await tabTo(page, page.getByTestId('demo-change-of-address'));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/fill\//);
  for (let step = 0; step < 40; step++) {
    const session: Session = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find((k) => k.startsWith('fillflow:session:'))!,
        )!,
      ),
    );
    if (session.state === 'reviewing') break;
    const field = session.schema.fields.find((f) => f.id === session.currentFieldId)!;
    if (!field.required) {
      await tabTo(page, page.getByRole('button', { name: 'Skip for now', exact: true }));
    } else {
      if (field.type === 'signature') {
        await tabTo(page, page.getByRole('button', { name: 'Type instead' }));
        await page.keyboard.press('Enter');
        await tabTo(page, page.getByLabel('Full name of the person signing'));
        await page.keyboard.type('Alex Rivera');
      } else {
        await tabTo(page, page.locator('#answer-input'));
        await page.keyboard.type(fixtureValue(field, ''));
      }
      await tabTo(page, page.getByRole('button', { name: 'Continue', exact: true }));
    }
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('todo-' + field.id)).not.toHaveAttribute(
      'data-status',
      'current',
    );
  }
  await expect(page).toHaveURL(/\/review\//);
  await expect(page.locator('.required-notice')).toHaveCount(0);
  await tabTo(page, page.getByRole('button', { name: 'Download filled PDF', exact: true }));
  const download = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
});
