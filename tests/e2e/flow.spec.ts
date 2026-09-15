import {expect,test} from '@playwright/test';
test('three answers, skip, back and jump preserve todo status',async({page})=>{
 await page.goto('/');await page.getByTestId('demo-insurance-claim').click();await expect(page.locator('#answer-input')).toBeVisible();
 for(const name of ['Rivera','Alex','J']){await page.locator('#answer-input').fill(name);await page.getByRole('button',{name:'Continue',exact:true}).click();}
 await expect(page.getByTestId('todo-f0')).toHaveAttribute('data-status','completed');await expect(page.getByTestId('todo-f2')).toHaveAttribute('data-status','completed');
 await page.getByRole('button',{name:'Skip for now'}).click();await expect(page.getByTestId('todo-f3')).toHaveAttribute('data-status','skipped');
 await page.getByRole('button',{name:'Previous',exact:true}).click();await expect(page.getByTestId('todo-f3')).toHaveAttribute('data-status','current');
 await page.getByTestId('todo-f0').click();await expect(page.locator('#answer-input')).toHaveValue('Rivera');await page.reload();await expect(page.locator('#answer-input')).toHaveValue('Rivera');
});
