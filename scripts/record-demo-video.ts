import { chromium, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fixtureValue } from '../tests/fixtures/answers';
import type { Session } from '../lib/schema';

// Records actual UI actions; the renderer adds captions and explicit editorial cuts.
// No responses, browser speech results or application state are injected.
async function main() {
  const baseURL = process.env.VIDEO_BASE_URL || 'http://127.0.0.1:3050';
  if (!['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname))
    throw new Error('This recording script is for the local application only.');
  const root = 'tmp/demo-video-' + new Date().toISOString().replace(/[:.]/g, '-');
  await mkdir(root, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: root, size: { width: 1440, height: 1000 } },
    locale: 'en-US',
  });
  const page = await context.newPage();
  const origin = performance.now();
  const errors: string[] = [];
  const api: { path: string; status: number }[] = [];
  const chapters: { title: string; start: number; duration: number; caption: string }[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith('/api/')) api.push({ path, status: r.status() });
  });
  const currentSession = (): Promise<Session> =>
    page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('fillflow:session:'));
      if (!key) throw new Error('No UI-created session');
      return JSON.parse(localStorage.getItem(key)!);
    });
  const hold = (ms: number) => page.waitForTimeout(ms);
  const chapter = async (
    title: string,
    duration: number,
    caption: string,
    action: () => Promise<void>,
  ) => {
    const start = (performance.now() - origin) / 1000;
    chapters.push({ title, start, duration, caption });
    console.log('Recording: ' + title);
    await action();
    const elapsed = (performance.now() - origin) / 1000 - start;
    if (elapsed > duration)
      throw new Error(`${title} exceeded its ${duration}s editorial slot (${elapsed.toFixed(1)}s)`);
    await hold((duration - elapsed) * 1000 + 150);
    await page.screenshot({ path: `${root}/${chapters.length}-${title}.png` });
  };
  try {
    await page.goto(baseURL);
    await expect(page.getByTestId('demo-insurance-claim')).toBeVisible();
    await chapter(
      'start',
      6,
      'Try a ready-to-use form. This recording uses the insurance demo.',
      async () => {
        await hold(2200);
        await page.getByTestId('demo-insurance-claim').hover();
        await hold(600);
        await page.getByTestId('demo-insurance-claim').click();
        await expect(page.locator('#answer-input')).toBeVisible();
      },
    );
    await chapter(
      'language',
      7,
      'Choose Chinese questions. Here, the fictional answer is typed.',
      async () => {
        await page.locator('header select').selectOption('zh-CN');
        await expect(page.locator('#question-heading')).toContainText('？');
        await hold(1800);
        await page.locator('#answer-input').pressSequentially('Rivera', { delay: 160 });
        await hold(700);
        await page.locator('.answer-buttons button.primary').click();
        await expect(page.getByTestId('todo-f1')).toHaveAttribute('data-status', 'current');
      },
    );
    await chapter(
      'explanation',
      8,
      "Read an explanation drawn from the form's own instructions.",
      async () => {
        await page.locator('header select').selectOption('en');
        await page.getByTestId('todo-f12').click();
        await page.getByRole('button', { name: 'What does this mean?', exact: true }).click();
        await expect(page.locator('.explanation')).toContainText('Supplemental');
      },
    );
    await chapter(
      'skip-and-return',
      7,
      'Skip an optional question, then return to fill it in.',
      async () => {
        await page.getByTestId('todo-f2').click();
        await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
        await expect(page.getByTestId('todo-f2')).toHaveAttribute('data-status', 'skipped');
        await hold(1800);
        await page.getByTestId('todo-f2').click();
        await page.locator('#answer-input').pressSequentially('J', { delay: 200 });
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await expect(page.getByTestId('todo-f2')).toHaveAttribute('data-status', 'completed');
      },
    );
    await chapter(
      'signature',
      11,
      'Draw a test signature and name the signer. The linked date fills automatically.',
      async () => {
        await page.getByTestId('todo-f30').click();
        await page.locator('#signature-name').pressSequentially('Alex Rivera', { delay: 85 });
        await drawTestSignature(page);
        await hold(1200);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        const s = await currentSession();
        const dateId = s.schema.signature?.dateFieldId;
        if (!dateId || !s.answers[dateId]?.value)
          throw new Error('Signature date was not populated');
        await page.getByTestId('todo-' + dateId).click();
        await expect(page.locator('#answer-input')).not.toHaveValue('');
      },
    );

    // These UI actions are retained in the raw recording, omitted from the 60-second cut.
    await page.getByTestId('todo-f1').click();
    for (let step = 0; step < 100; step++) {
      const s = await currentSession();
      if (s.state === 'reviewing') break;
      const f = s.schema.fields.find((f) => f.id === s.currentFieldId)!;
      if (!f.required && s.answers[f.id]?.status !== 'answered') {
        await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
      } else {
        if (f.type === 'signature') {
          if (s.answers[f.id]?.status !== 'answered')
            throw new Error('Expected the recorded signature');
        } else if (f.type === 'checkbox') {
          await page.getByRole('radio', { name: 'No', exact: true }).check();
        } else if (f.type === 'select') {
          await page.locator('#answer-input').selectOption(fixtureValue(f, ''));
        } else if (f.type === 'multiselect') {
          await page.locator('.choice-list input').first().check();
        } else {
          await page.locator('#answer-input').fill(s.answers[f.id]?.value || fixtureValue(f, ''));
        }
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
      }
      await expect.poll(async () => (await currentSession()).currentFieldId).not.toBe(f.id);
    }
    await expect(page).toHaveURL(/\/review\//);
    await expect(page.locator('.required-notice')).toHaveCount(0);
    await page.evaluate(() => scrollTo(0, 0));
    await chapter(
      'review-download',
      8,
      'Jump cut: required answers entered; optional items skipped. Review and download.',
      async () => {
        await hold(2500);
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download filled PDF', exact: true }).click();
        await (await download).saveAs(root + '/filled.pdf');
        await expect(page.locator('.document-preview img')).toHaveCount(2);
      },
    );
    await chapter(
      'filled-pdf',
      9,
      'Inspect the actual downloaded PDF, including the signature and date.',
      async () => {
        await page.locator('.document-preview img').first().scrollIntoViewIfNeeded();
        await hold(4300);
        await page.mouse.wheel(0, 430);
      },
    );
    await chapter(
      'close',
      4,
      'Try three demos at formlilt.vercel.app. Voice and upload footage still to record.',
      async () => {
        await page.goto(baseURL);
      },
    );
    expect(api.filter((r) => r.status >= 400)).toEqual([]);
    expect(api.some((r) => r.path === '/api/extract')).toBe(false);
    expect(errors).toEqual([]);
    const bytes = await readFile(root + '/filled.pdf');
    await writeFile(
      root + '/manifest.json',
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          root,
          baseURL,
          sourceCommit: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(),
          buildId: (await readFile('.next/BUILD_ID', 'utf8')).trim(),
          source: 'Actual local production UI using the precomputed insurance demo',
          input: 'Fictional keyboard answers and a pointer-drawn test signature',
          mocked: false,
          audio: false,
          chapters,
          errors,
          api,
          exportSha256: createHash('sha256').update(bytes).digest('hex'),
          openRequirements: [
            'Live-upload and voice-answer footage',
            'Question speech audio',
            'Owner acceptance',
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close();
    await page.video()!.saveAs(root + '/raw.webm');
    await browser.close();
  }
  console.log('Recorded source: ' + root);
}

async function drawTestSignature(page: Page) {
  const box = await page.locator('.signature-canvas').boundingBox();
  if (!box) throw new Error('No signature canvas');
  const strokes = [
    [
      [0.09, 0.73],
      [0.15, 0.24],
      [0.22, 0.75],
    ],
    [
      [0.12, 0.52],
      [0.19, 0.52],
    ],
    [
      [0.28, 0.74],
      [0.28, 0.25],
      [0.37, 0.25],
      [0.4, 0.36],
      [0.36, 0.48],
      [0.28, 0.49],
      [0.43, 0.74],
    ],
    [
      [0.44, 0.67],
      [0.5, 0.56],
      [0.55, 0.67],
      [0.6, 0.55],
      [0.66, 0.65],
      [0.72, 0.54],
      [0.8, 0.62],
    ],
    [
      [0.1, 0.86],
      [0.84, 0.8],
    ],
  ];
  for (const stroke of strokes) {
    await page.mouse.move(box.x + stroke[0][0] * box.width, box.y + stroke[0][1] * box.height);
    await page.mouse.down();
    for (const [x, y] of stroke.slice(1)) {
      await page.mouse.move(box.x + x * box.width, box.y + y * box.height, { steps: 8 });
      await page.waitForTimeout(65);
    }
    await page.mouse.up();
  }
}
void main();
