import {expect,test} from '@playwright/test';
test('a demo opens a persisted form without a model request',async({page})=>{
 let extractionCalls=0;page.on('request',request=>{if(request.url().endsWith('/api/extract'))extractionCalls++;});
 await page.goto('/');await page.getByTestId('demo-insurance-claim').click();await expect(page).toHaveURL(/\/fill\/[a-f0-9-]+/);
 await expect(page.getByRole('heading',{name:/CHAMPVA/i}).first()).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:/CHAMPVA/i}).first()).toBeVisible();
 expect(extractionCalls).toBe(0);expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('fillflow:session:')))).toBe(true);
});
