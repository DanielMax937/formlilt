import {expect,test,vi} from 'vitest';
vi.mock('@/lib/rate-limit',()=>({enforceLimit:vi.fn()}));
vi.mock('@/lib/llm',()=>({streamValidated:vi.fn()}));
import {POST} from '@/app/api/turn/route';
import {sample} from '../fixtures/form';
async function turn(body:unknown){return POST(new Request('http://localhost/api/turn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));}
const base={schema:sample,answers:{},currentFieldId:'name',action:'answer',input:'Alex',uiLanguage:'en'};
test('valid answers return deterministic streamed completion',async()=>{const res=await turn(base);expect(res.status).toBe(200);expect(res.headers.get('cache-control')).toBe('no-store');const data=JSON.parse((await res.text()).trim()).data;expect(data.nextFieldId).toBeNull();expect(data.done).toBe(true);});
test('invalid input stays on current field and reports validation',async()=>{const res=await turn({...base,input:''});expect((await res.json()).validation.ok).toBe(false);});
test('explanations quote help and unknown field requests fail',async()=>{const res=await turn({...base,action:'explain'});expect(JSON.parse((await res.text()).trim()).data.explanation).toContain('does not explain');expect((await turn({...base,currentFieldId:'unknown'})).status).toBe(400);});
