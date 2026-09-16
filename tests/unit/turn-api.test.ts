import { expect, test, vi } from 'vitest';
vi.mock('@/lib/rate-limit', () => ({ enforceLimit: vi.fn() }));
vi.mock('@/lib/llm', () => ({ streamValidated: vi.fn() }));
import { POST } from '@/app/api/turn/route';
import { sample } from '../fixtures/form';
import { streamValidated } from '@/lib/llm';
async function turn(body: unknown) {
  return POST(
    new Request('http://localhost/api/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}
const base = {
  schema: sample,
  answers: {},
  currentFieldId: 'name',
  action: 'answer',
  input: 'Alex',
  uiLanguage: 'en',
};
test('valid answers return deterministic streamed completion', async () => {
  const res = await turn(base);
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toBe('no-store');
  const data = JSON.parse((await res.text()).trim()).data;
  expect(data.nextFieldId).toBeNull();
  expect(data.done).toBe(true);
});
test('invalid input stays on current field and reports validation', async () => {
  const res = await turn({ ...base, input: '' });
  expect((await res.json()).validation.ok).toBe(false);
});
test('explanations quote help and unknown field requests fail', async () => {
  const res = await turn({ ...base, action: 'explain' });
  expect(JSON.parse((await res.text()).trim()).data.explanation).toContain('does not explain');
  expect((await turn({ ...base, currentFieldId: 'unknown' })).status).toBe(400);
});
test('scan explanations return the extracted source quote without generating new advice', async () => {
  vi.mocked(streamValidated).mockClear();
  const help = 'Please initial each statement to indicate your understanding.';
  const schema = {
    ...sample,
    precision: 'approximate',
    pages: sample.pages.map((p) => ({ ...p, kind: 'scan' })),
    fields: [
      {
        ...sample.fields[0],
        help,
        anchor: { page: 0, bbox: [0.1, 0.1, 0.4, 0.2], placement: 'inbox' },
      },
    ],
  };
  const response = await turn({ ...base, schema, action: 'explain' });
  expect(response.status).toBe(200);
  expect(JSON.parse((await response.text()).trim()).data.explanation).toBe(help);
  expect(streamValidated).not.toHaveBeenCalled();
});

test('translated questions are marked as complete and remain on the same field', async () => {
  vi.mocked(streamValidated).mockImplementationOnce(async function* () {
    yield { result: { question: '你的全名是什么？' } } as never;
  });
  const res = await turn({ ...base, action: 'explain', questionOnly: true, uiLanguage: 'zh-CN' });
  const messages = (await res.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(messages.at(-1).data).toMatchObject({
    question: '你的全名是什么？',
    translated: true,
    nextFieldId: 'name',
    done: false,
  });
});

test('translation requires confirmation and a confirmed answer avoids another model call', async () => {
  const schema = {
    ...sample,
    fields: [{ ...sample.fields[0], id: 'reason', label: 'Reason for request' }],
    sections: [{ ...sample.sections[0], fieldIds: ['reason'] }],
  };
  const request = { ...base, schema, currentFieldId: 'reason', input: '搬家', uiLanguage: 'zh-CN' };
  vi.mocked(streamValidated).mockImplementationOnce(async function* () {
    yield {
      result: { question: '确认填写 Moving house？', normalizedValue: 'Moving house' },
    } as never;
  });
  const res = await turn(request);
  const messages = (await res.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(messages.at(-1).data).toMatchObject({
    validation: { ok: true, normalizedValue: 'Moving house' },
    nextFieldId: 'reason',
    done: false,
  });
  vi.mocked(streamValidated).mockClear();
  const confirmed = await turn({ ...request, input: 'Moving house', confirmed: true });
  expect(JSON.parse((await confirmed.text()).trim()).data.done).toBe(true);
  expect(streamValidated).not.toHaveBeenCalled();
});
