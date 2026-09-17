import { z } from 'zod';
import { TurnResult } from './schema';

const Event = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pending') }),
  z.object({ type: z.literal('result'), data: TurnResult }),
  z.object({
    type: z.literal('wording'),
    data: z.object({ explanation: z.string().max(1500).optional() }),
  }),
  z.object({
    type: z.literal('error'),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
]);

// A successful HTTP status can still contain a truncated model stream.
export async function* readTurnStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = done ? '' : lines.pop()!;
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = Event.parse(JSON.parse(line));
        if (event.type === 'result' || event.type === 'error') completed = true;
        yield event;
      }
      if (done) break;
    }
    if (!completed) throw new Error('Incomplete form response');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
