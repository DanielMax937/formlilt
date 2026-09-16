import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

const Manifest = z
  .object({
    chapters: z
      .array(
        z.object({
          title: z.string(),
          start: z.number().nonnegative(),
          duration: z.number().positive(),
          caption: z.string(),
        }),
      )
      .min(1),
  })
  .passthrough();

async function main() {
  const root = process.argv[2];
  if (!/^tmp\/demo-video-[\dTZ.-]+$/.test(root || ''))
    throw new Error('Pass the recording directory printed by record-demo-video.ts');
  const manifest = Manifest.parse(JSON.parse(await readFile(root + '/manifest.json', 'utf8')));
  const total = manifest.chapters.reduce((sum, c) => sum + c.duration, 0);
  if (total !== 60) throw new Error('Expected exactly 60 seconds');
  await mkdir('launch', { recursive: true });
  const font = resolve('public/fonts/NotoSans-Regular.ttf');
  await writeFile(
    root + '/badge.txt',
    'REVIEW DRAFT  /  ACTUAL LOCAL DEMO  /  FICTIONAL DATA  /  KEYBOARD INPUT',
  );
  const segments: string[] = [];
  const srt: string[] = [];
  let elapsed = 0;
  for (const [i, c] of manifest.chapters.entries()) {
    const captionFile = resolve(root, `caption-${i}.txt`);
    await writeFile(captionFile, wrap(c.caption, 102));
    const segment = resolve(root, `segment-${i}.mp4`);
    const filters = [
      'setpts=PTS-STARTPTS,fps=25',
      'pad=1440:1120:0:40:color=0x132d24',
      `drawtext=fontfile='${font}':textfile='${resolve(root, 'badge.txt')}':expansion=none:fontsize=18:fontcolor=0xdde8d9:x=24:y=9`,
      `drawtext=fontfile='${font}':textfile='${captionFile}':expansion=none:fontsize=23:line_spacing=7:fontcolor=white:x=(w-text_w)/2:y=1047`,
    ].join(',');
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-ss',
        String(c.start),
        '-i',
        root + '/raw.webm',
        '-frames:v',
        String(c.duration * 25),
        '-vf',
        filters,
        '-an',
        '-r',
        '25',
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        segment,
      ],
      { stdio: 'inherit' },
    );
    segments.push(`file '${segment}'`);
    srt.push(
      `${i + 1}\n${timestamp(elapsed)} --> ${timestamp(elapsed + c.duration)}\n${c.caption}\n`,
    );
    elapsed += c.duration;
  }
  const list = root + '/segments.txt';
  await writeFile(list, segments.join('\n') + '\n');
  const output = 'launch/formlilt-demo-draft.mp4';
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-v',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      list,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      output,
    ],
    { stdio: 'inherit' },
  );
  const metadata = JSON.parse(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_name,width,height,r_frame_rate:format=duration,size',
      '-of',
      'json',
      output,
    ]).toString(),
  );
  if (Number(metadata.format.duration) !== 60)
    throw new Error('Encoded duration is not 60 seconds');
  await writeFile('launch/formlilt-demo-draft.srt', srt.join('\n'));
  await copyFile(root + '/filled.pdf', 'launch/video-sample-insurance.pdf');
  await writeFile(
    'launch/video-manifest.json',
    JSON.stringify(
      {
        ...manifest,
        output,
        renderedAt: new Date().toISOString(),
        outputSha256: createHash('sha256')
          .update(await readFile(output))
          .digest('hex'),
        metadata,
        editing:
          'Actual recording, chronological chapters. Remaining answer entry omitted at the labeled jump cut. No application footage or speech results fabricated.',
        status:
          'Review draft; does not satisfy the complete live-upload/voice scenario in SPEC section 2.3.',
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ output, metadata }));
}
function wrap(text: string, max: number) {
  const lines: string[] = [''];
  for (const word of text.split(' ')) {
    if (lines.at(-1)!.length + word.length + 1 > max) lines.push(word);
    else lines[lines.length - 1] += (lines.at(-1) ? ' ' : '') + word;
  }
  return lines.join('\n');
}
function timestamp(seconds: number) {
  return new Date(seconds * 1000).toISOString().slice(11, 23).replace('.', ',');
}
void main();
