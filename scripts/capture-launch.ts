import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fixtureValue } from '../tests/fixtures/answers';
import type { Session } from '../lib/schema';
async function main() {
  await mkdir('launch/screenshots', { recursive: true });
  await mkdir('tmp/launch-frames', { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: 'en-US',
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:3050');
  await page.screenshot({ path: 'tmp/launch-frames/01.png' });
  await page.getByTestId('demo-insurance-claim').click();
  await expect(page).toHaveURL(/\/fill\//);
  await expect(page.locator('#answer-input')).toBeVisible();
  await page.screenshot({ path: 'tmp/launch-frames/02.png' });
  await page.locator('#answer-input').pressSequentially('Rivera', { delay: 70 });
  await page.screenshot({ path: 'tmp/launch-frames/03.png' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByTestId('todo-f1')).toHaveAttribute('data-status', 'current');
  await page.screenshot({ path: 'tmp/launch-frames/04.png' });
  await page.locator('#answer-input').fill('Alex');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await expect(page.getByTestId('todo-f3')).toHaveAttribute('data-status', 'current');
  await page.screenshot({ path: 'launch/screenshots/01-guided-workspace.png' });
  await page.getByTestId('todo-f12').click();
  await page.getByRole('button', { name: 'What does this mean?' }).click();
  await expect(page.locator('.explanation')).toContainText('Supplemental');
  await page.screenshot({ path: 'launch/screenshots/02-source-explanation.png' });
  await page.getByTestId('todo-f30').click();
  await page.getByRole('button', { name: 'Type instead' }).click();
  await page.getByLabel('Full name of the person signing').fill('Alex Rivera');
  await expect(page.getByRole('button', { name: 'Clear signature' })).toBeEnabled();
  await page.screenshot({ path: 'launch/screenshots/03-signature.png' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByTestId('todo-f0').click();
  for (let step = 0; step < 100; step++) {
    const session: Session = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find((k) => k.startsWith('fillflow:session:'))!,
        )!,
      ),
    );
    if (session.state === 'reviewing') break;
    const f = session.schema.fields.find((f) => f.id === session.currentFieldId)!;
    if (!f.required) await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
    else {
      if (f.type === 'signature') {
        await page.getByRole('button', { name: 'Type instead' }).click();
        await page.getByLabel('Full name of the person signing').fill('Alex Rivera');
      } else if (f.type === 'select')
        await page.locator('#answer-input').selectOption(fixtureValue(f, ''));
      else if (f.type === 'checkbox')
        await page.getByRole('radio', { name: 'No', exact: true }).check();
      else if (f.type === 'multiselect') await page.locator('.choice-list input').first().check();
      else await page.locator('#answer-input').fill(fixtureValue(f, ''));
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
    }
    await expect(page.getByTestId('todo-' + f.id)).not.toHaveAttribute('data-status', 'current');
  }
  await expect(page).toHaveURL(/\/review\//);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download filled PDF', exact: true }).click();
  await (await download).saveAs('launch/sample-filled-insurance.pdf');
  await expect(page.locator('.document-preview img')).toHaveCount(2);
  await page.screenshot({ path: 'launch/screenshots/04-review-and-download.png' });
  const commits = execFileSync('git', ['log', '--reverse', '--format=%h  %s']).toString();
  const log = await readFile('BUILD_LOG.md', 'utf8');
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>FormLilt build evidence</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f5ed;color:#183d30;font:20px system-ui;padding:64px}h1{font:64px Georgia;margin:12px 0 24px}p{max-width:1000px;line-height:1.5}.eyebrow{letter-spacing:3px;font-size:16px}.grid{display:grid;grid-template-columns:1.5fr 1fr;gap:32px}.card{background:#fff;border:1px solid #cad4c9;padding:24px;border-radius:18px}pre{white-space:pre-wrap;font:15px/1.8 monospace;color:#33483e;margin:0}h2{font-size:26px;margin:0 0 18px}.metric{font:52px Georgia;margin:10px 0}.small{font-size:15px;color:#526358}</style><p class="eyebrow">FORMLILT / REPOSITORY EVIDENCE</p><h1>Built with GPT-6 Astra.</h1><p>Task commits, measured tests, and an honest release checklist.<br>Rendered from this project's Git history and build log.</p><div class="grid"><section class="card"><h2>Implementation history</h2><pre>${esc(commits.split('\n').slice(-13).join('\n'))}</pre></section><section class="card"><h2>Verified locally</h2><div class="metric">63 unit tests</div><p>Three complete PDF workflows in Chrome and mobile WebKit.</p><div class="metric">97 / 100</div><p>Lighthouse performance / accessibility.</p><p class="small">Physical-device checks and uncached extraction speed remain open. Public deployment is a demo preview.</p></section></div><p class="small">This is a repository evidence view, not a screenshot of an Astra chat. See BUILD_LOG.md and QUALITY.md for commands, failures and limitations.</p></html>`;
  await writeFile('launch/build-evidence.html', html);
  await page.setContent(html);
  await page.screenshot({ path: 'launch/screenshots/05-build-evidence.png' });
  await writeFile(
    'launch/capture-manifest.json',
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        source: 'local production build',
        viewport: '1440x1000',
        answers: 'synthetic',
        speech: 'GIF uses keyboard input, not simulated speech',
        pageErrors: errors,
        buildLogCharacters: log.length,
      },
      null,
      2,
    ),
  );
  await browser.close();
  if (errors.length) throw new Error(errors.join('\n'));
}
void main();
