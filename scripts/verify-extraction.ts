import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { extractForm } from '../lib/extract-form';
import { parseDocument } from '../lib/pdf-extract';
async function main() {
  const slug = process.argv[2] ?? 'photo';
  const original = new Uint8Array(await readFile(slug === 'photo' ? 'tests/fixtures/photo.jpg' : `public/demo-forms/${slug}.pdf`));
  const names = slug === 'photo' ? [] : (await readdir('tmp/demo-pages')).filter(f => f.startsWith(slug+'-') && f.endsWith('.jpg')).sort();
  const images = slug === 'photo' ? [original] : await Promise.all(names.map(async n => new Uint8Array(await readFile(`tmp/demo-pages/${n}`))));
  const suffix = process.env.BENCH_TAG ? '.'+process.env.BENCH_TAG : '';
  const start = performance.now();
  try {
    const schema = await extractForm(original,images);
    const doc = await parseDocument(original);
    const evidence = { slug, model: process.env.AGENT_IM_MODEL ?? 'codex-login/gpt-6-astra', structured: process.env.LLM_STRUCTURED_OUTPUT ?? 'false', seconds: Number(((performance.now()-start)/1000).toFixed(3)), fields: schema.fields.length, acroMatched: schema.fields.filter(f => f.acroName).length, widgets: doc.acroFields.length, labelsMatched: schema.fields.filter(f => !f.anchor || doc.pages[f.anchor.page].kind === 'scan' || doc.pages[f.anchor.page].textItems.some(t=>t.str.includes(f.anchor!.labelText ?? '\u0000'))).length };
    await mkdir('tmp/schemas',{recursive:true}); await writeFile(`tmp/schemas/${slug}${suffix}.json`,JSON.stringify(schema,null,2)); await writeFile(`tmp/schemas/${slug}${suffix}.evidence.json`,JSON.stringify(evidence,null,2)); console.info(evidence);
  } catch(e) { console.error(slug, 'FAILED', typeof e === 'object' && e && 'code' in e ? e.code : e); if (typeof e === 'object' && e && 'cause' in e) { const c = e.cause as {message?:string; text?:string; cause?:unknown}; console.error(c.message,c.text?.slice(0,2500),c.cause); } process.exitCode=1; }
}
main();
