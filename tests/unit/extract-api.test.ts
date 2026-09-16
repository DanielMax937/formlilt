import { readFile } from 'node:fs/promises';
import { beforeEach, expect, test, vi } from 'vitest';
import { sample } from '../fixtures/form';
vi.mock('@/lib/extract-form', () => ({ extractForm: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ enforceLimit: vi.fn() }));
import { extractForm } from '@/lib/extract-form';
import { POST } from '@/app/api/extract/route';
beforeEach(() => vi.mocked(extractForm).mockResolvedValue(sample as never));
test('extract returns validated schema and no-store headers', async () => {
  const data = new FormData();
  data.set('original', new File([await readFile('tests/fixtures/photo.jpg')], 'test.jpg'));
  data.append('pages[]', new File([await readFile('tests/fixtures/photo.jpg')], 'page.jpg'));
  const res = await POST(
    new Request('http://localhost/api/extract', { method: 'POST', body: data }),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect((await res.json()).schema.title).toBe('Registration');
});
test('missing, forged and oversized uploads are rejected', async () => {
  expect(
    (
      await POST(
        new Request('http://localhost/api/extract', { method: 'POST', body: new FormData() }),
      )
    ).status,
  ).toBe(400);
  const data = new FormData();
  data.set('original', new File(['<script>'], 'attack.pdf', { type: 'application/pdf' }));
  data.append('pages[]', new File(['x'], 'x.jpg'));
  const res = await POST(
    new Request('http://localhost/api/extract', { method: 'POST', body: data }),
  );
  expect(res.status).toBe(400);
});
