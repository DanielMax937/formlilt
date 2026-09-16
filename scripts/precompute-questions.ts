import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { FormSchema } from '../lib/schema';
import { generateValidated } from '../lib/llm';
async function main() {
  await Promise.all(
    ['change-of-address', 'insurance-claim', 'medical-release'].map(async (slug) => {
      const form = FormSchema.parse(
        JSON.parse(await readFile(`public/demo-forms/${slug}.schema.json`, 'utf8')),
      );
      const lines = z.array(z.string().min(2).max(200)).length(form.fields.length);
      const Result = z.object({ zh: lines, es: lines, ja: lines });
      const start = Date.now();
      try {
        const result = await generateValidated(Result, [
          {
            role: 'user',
            content: `For each field below, write one short, friendly question asking the user for that information. Return three arrays in exactly the same field order: zh (Simplified Chinese), es (Spanish), ja (Japanese). Translate the whole question naturally. Preserve the field's meaning, person/role, date format, and row number; do not invent facts or advice. Do not translate the answers or options. Each question should generally be under 80 characters, certainly under 200. Use the form title, section and help to avoid changing meaning (e.g. an address-change checkbox is not a question about whether someone plans to file a tax return). Form: ${form.title}. Data: <form_text>${JSON.stringify(form.fields.map((f) => ({ label: f.label, type: f.type, section: form.sections.find((s) => s.id === f.section)?.title, help: f.help, format: f.constraints?.dateFormat })))}</form_text>`,
          },
        ]);
        const output = Object.fromEntries(
          Object.entries(result).map(([key, list]) => [
            key === 'zh' ? 'zh-CN' : key,
            Object.fromEntries(form.fields.map((f, i) => [f.id, list[i]])),
          ]),
        );
        await writeFile(
          `public/demo-forms/${slug}.questions.json`,
          JSON.stringify(output, null, 2) + '\n',
        );
        console.log(
          JSON.stringify({
            slug,
            fields: form.fields.length,
            languages: 3,
            milliseconds: Date.now() - start,
          }),
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            slug,
            error: typeof error === 'object' && error && 'code' in error ? error.code : 'failed',
          }),
        );
        process.exitCode = 1;
      }
    }),
  );
}
void main();
