import { afterEach, expect, test, vi } from 'vitest';
import { fetchArk } from '@/lib/ark-transport';

afterEach(() => vi.unstubAllGlobals());

test('Ark transport preserves authentication, JSON, cancellation and streaming responses', async () => {
  const controller = new AbortController();
  const response = new Response('data: response\n\n');
  const send = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', send);
  const headers = { Authorization: 'Bearer synthetic-test-key' };
  const body = '{"messages":[],"stream":true}';
  expect(
    await fetchArk('https://ark.example/api/v3/chat/completions', {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    }),
  ).toBe(response);
  const options = send.mock.calls[0][1];
  expect(options).toMatchObject({ method: 'POST', headers, body, signal: controller.signal });
  expect(options.dispatcher).toBeDefined();
  controller.abort();
  expect(options.signal.aborted).toBe(true);
});

test('Ark transport leaves failures for the bounded SDK retry policy', async () => {
  const error = new TypeError('synthetic connection failure');
  const send = vi.fn().mockRejectedValue(error);
  vi.stubGlobal('fetch', send);
  await expect(fetchArk('https://ark.example/api/v3/chat/completions')).rejects.toBe(error);
  expect(send).toHaveBeenCalledTimes(1);
});
