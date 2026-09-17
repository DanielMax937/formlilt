import { afterEach, expect, test, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { sample } from '../fixtures/form';
vi.mock('@/lib/extract-form', () => ({ extractForm: vi.fn().mockResolvedValue(sample) }));
import { POST } from '@/app/api/extract/route';
import { enforceLimit, memoryLimit } from '@/lib/rate-limit';
import { extractForm } from '@/lib/extract-form';
afterEach(() => vi.unstubAllEnvs());
test('fourth real upload request receives 429 and safe headers', async () => {
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('RATE_LIMIT_EXTRACT_PER_DAY', '3');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  const image = await readFile('tests/fixtures/photo.jpg');
  const statuses: number[] = [];
  for (let i = 0; i < 4; i++) {
    const data = new FormData();
    data.set('original', new File([image], 'photo.jpg'));
    data.append('pages[]', new File([image], 'page.jpg'));
    const response = await POST(
      new Request('http://localhost/api/extract', { method: 'POST', body: data }),
    );
    statuses.push(response.status);
    expect(response.headers.get('cache-control')).toBe('no-store');
    if (i === 3) {
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      expect((await response.json()).error.code).toBe('rate_limited');
    }
  }
  expect(statuses).toEqual([200, 200, 200, 429]);
  expect(extractForm).toHaveBeenCalledTimes(3);
});
test('sliding windows expire; 121st turn is denied', () => {
  const key = crypto.randomUUID();
  for (let i = 0; i < 120; i++) expect(memoryLimit(key, 120, 3600000, 0)).toBe(true);
  expect(memoryLimit(key, 120, 3600000, 1)).toBe(false);
  expect(memoryLimit(key, 120, 3600000, 3600000)).toBe(true);
});
test('public deployment fails closed without shared Redis configuration', async () => {
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('RATE_LIMIT_MODE', 'shared');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  await expect(
    enforceLimit(new Request('https://example.com/api/extract'), 'extract'),
  ).rejects.toMatchObject({ status: 503, code: 'rate_limit_unavailable' });
});
test('explicit memory mode allows hosted uploads and limits each IP independently', async () => {
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('RATE_LIMIT_MODE', 'memory');
  vi.stubEnv('RATE_LIMIT_EXTRACT_PER_DAY', '3');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  const request = (ip: string) =>
    new Request('https://example.com/api/extract', {
      headers: { 'x-forwarded-for': ip },
    });
  for (let i = 0; i < 3; i++) await enforceLimit(request('192.0.2.41'), 'extract');
  await expect(enforceLimit(request('192.0.2.41'), 'extract')).rejects.toMatchObject({
    status: 429,
    code: 'rate_limited',
  });
  await expect(enforceLimit(request('192.0.2.42'), 'extract')).resolves.toBeUndefined();
});
