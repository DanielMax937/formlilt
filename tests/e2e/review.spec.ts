import {expect,test} from '@playwright/test';
test('review highlights missing answers, saves inline edits and shows the original pages',async({page})=>{
 await page.goto('/');await page.getByTestId('demo-insurance-claim').click();await expect(page).toHaveURL(/\/fill\//);await page.getByRole('link',{name:'Review answers'}).click();await expect(page).toHaveURL(/\/review\//);
 await expect(page.locator('.required-notice')).toBeVisible();await expect(page.getByTestId('edit-f0').locator('../..')).toHaveClass(/needs-attention/);
 await page.getByTestId('edit-f0').click();await page.locator('#answer-input').fill('Rivera');await page.getByRole('button',{name:'Save answer',exact:true}).click();await expect(page.getByTestId('edit-f0').locator('../..')).not.toHaveClass(/needs-attention/);await page.reload();await expect(page.getByText('Rivera',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Original form',exact:true}).click();await expect(page.locator('.document-preview img')).toHaveCount(2,{timeout:20000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Download filled PDF',exact:true}).click();await expect(page.locator('.export-panel [role=alert]')).toContainText('Required answers');
});
