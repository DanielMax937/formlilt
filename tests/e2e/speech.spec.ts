import {expect,test} from '@playwright/test';
test('voice input fills an editable answer and reading is opt-in',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'SpeechRecognition',{value:function(){const self=this as unknown as {onresult:(event:unknown)=>void;onend:()=>void;start:()=>void;stop:()=>void;abort:()=>void};self.start=()=>setTimeout(()=>{self.onresult({results:[[{transcript:'Alex Rivera'}]]});self.onend();},10);self.stop=()=>self.onend();self.abort=()=>{};},configurable:true});});
 await page.goto('/');await page.getByTestId('demo-insurance-claim').click();await expect(page).toHaveURL(/\/fill\//);
 await expect(page.getByRole('button',{name:'Read questions aloud'})).toHaveAttribute('aria-pressed','false');
 await page.getByRole('button',{name:'Speak your answer'}).click();await expect(page.locator('#answer-input')).toHaveValue('Alex Rivera');
 await page.locator('#answer-input').fill('Rivera');await page.getByRole('button',{name:'Read questions aloud'}).click();await expect(page.getByRole('button',{name:'Stop reading aloud'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Stop reading aloud'}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByTestId('todo-f0')).toHaveAttribute('data-status','completed');
});
