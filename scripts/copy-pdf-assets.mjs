import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const root = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
mkdirSync('public', { recursive: true });
cpSync(join(root, 'build/pdf.worker.min.mjs'), 'public/pdf.worker.min.mjs');
for (const dir of ['cmaps', 'standard_fonts'])
  cpSync(join(root, dir), join('public', dir), { recursive: true });
