import {expect,test} from 'vitest';
import {sameOrigin} from '@/lib/errors';
import {FormSchema} from '@/lib/schema';
import {sample} from '../fixtures/form';
test('accepts the actual host used by the browser and rejects unrelated origins',()=>{expect(()=>sameOrigin(new Request('http://localhost:3050/api/turn',{headers:{host:'127.0.0.1:3050',origin:'http://127.0.0.1:3050'}}))).not.toThrow();expect(()=>sameOrigin(new Request('http://localhost:3050/api/turn',{headers:{host:'127.0.0.1:3050',origin:'https://evil.example'}}))).toThrow();});
test('normalizes model-returned language names before deciding whether values need translation',()=>{expect(FormSchema.parse({...sample,language:'English'}).language).toBe('en');});
