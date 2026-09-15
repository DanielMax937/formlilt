import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {FormSchema} from './schema';
let known:Promise<Set<string>>|undefined;
const digest=(schema:FormSchema)=>createHash('sha256').update(JSON.stringify(FormSchema.parse(schema))).digest('hex');
/** A client-supplied slug is never enough to bypass a quota. Compare the complete schema. */
export async function isKnownDemo(schema:FormSchema){known??=Promise.all(['change-of-address','insurance-claim','medical-release'].map(async slug=>digest(FormSchema.parse(JSON.parse(await readFile(path.join(process.cwd(),'public','demo-forms',slug+'.schema.json'),'utf8')))))).then(items=>new Set(items));return (await known).has(digest(schema));}
