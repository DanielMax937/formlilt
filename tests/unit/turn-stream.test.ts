import { expect, test } from 'vitest';
import { readTurnStream } from '@/lib/turn-stream';

function body(parts: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}
const encode = (text: string) => new TextEncoder().encode(text);
const result = {
  type: 'result',
  data: { validation: { ok: true }, nextFieldId: null, question: '完成', done: true },
};
async function collect(stream: ReadableStream<Uint8Array>) {
  const events = [];
  for await (const event of readTurnStream(stream)) events.push(event);
  return events;
}
test('accepts a complete result split through a UTF-8 character without a trailing newline', async () => {
  const bytes = encode(JSON.stringify(result));
  const split = bytes.indexOf(0xe5) + 1;
  expect(await collect(body([bytes.slice(0, split), bytes.slice(split)]))).toEqual([result]);
});
test('rejects an HTTP-success stream that ends after pending or partial wording', async () => {
  for (const text of [
    '',
    '{"type":"pending"}\n',
    '{"type":"pending"}\n{"type":"wording","data":{"explanation":"partial"}}\n',
  ]) {
    await expect(collect(body([encode(text)]))).rejects.toThrow('Incomplete form response');
  }
});
test('preserves explicit safe errors and rejects malformed terminal data', async () => {
  const error = { type: 'error', error: { code: 'llm_error', message: 'Try again.' } };
  expect(await collect(body([encode(JSON.stringify(error))]))).toEqual([error]);
  await expect(collect(body([encode('{"type":"result","data":{}}\n')]))).rejects.toThrow();
});
