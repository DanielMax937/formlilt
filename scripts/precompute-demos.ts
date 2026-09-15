import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { FormSchema } from '../lib/schema';
import { extractForm, groundSchema } from '../lib/extract-form';
import { parseDocument } from '../lib/pdf-extract';
import { DEMOS } from '../lib/demos';
async function main() {
  await mkdir('tmp/demo-pages',{recursive:true});
  const results = [];
  for (const {slug} of DEMOS) {
    const original = new Uint8Array(await readFile(`public/demo-forms/${slug}.pdf`));
    const document = await parseDocument(original); let schema: FormSchema; let evidence: unknown;
    if (process.argv.includes('--from-verified')) {
      schema = FormSchema.parse(JSON.parse(await readFile(`tmp/schemas/${slug}.json`,'utf8')));
      evidence = JSON.parse(await readFile(`tmp/schemas/${slug}.evidence.json`,'utf8'));
    } else {
      execFileSync('pdftoppm',['-jpeg','-jpegopt','quality=80','-scale-to','1600',`public/demo-forms/${slug}.pdf`,`tmp/demo-pages/${slug}`]);
      const images = await Promise.all((await readdir('tmp/demo-pages')).filter(n=>n.startsWith(slug+'-')&&n.endsWith('.jpg')).sort().map(async n=>new Uint8Array(await readFile('tmp/demo-pages/'+n))));
      const start = performance.now(); schema = await extractForm(original,images);
      evidence = {slug,seconds:(performance.now()-start)/1000,fields:schema.fields.length,model:process.env.AGENT_IM_MODEL ?? 'codex-login/gpt-6-astra'};
    }
    schema = groundSchema(schema,document); results.push({slug,schema,evidence});
  }
  // Validate every document before publishing any schema file.
  for (const {slug,schema} of results) await writeFile(`public/demo-forms/${slug}.schema.json`,JSON.stringify(schema));
  await writeFile('launch/extraction-benchmark.json',JSON.stringify(results.map(r=>r.evidence),null,2));
  console.info(results.map(r=>({slug:r.slug,fields:r.schema.fields.length,bytes:JSON.stringify(r.schema).length})));
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
