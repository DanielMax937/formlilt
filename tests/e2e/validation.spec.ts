import {expect,test} from '@playwright/test';
test('bad email stays on the question; help comes from form instructions',async({page})=>{
 await page.goto('/');await page.getByTestId('demo-insurance-claim').click();await page.getByTestId('todo-f11').click();await page.locator('#answer-input').fill('not-an-email');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('#answer-error')).toContainText('email');await expect(page.getByTestId('todo-f11')).toHaveAttribute('data-status','current');
 await page.getByRole('button',{name:'What does this mean?'}).click();await expect(page.locator('.explanation')).toBeVisible();await expect(page.locator('.explanation')).toContainText(/form|email|Email/);
});
