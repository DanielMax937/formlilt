import { expect, test } from 'vitest';
import { GET } from '@/app/api/demo/[slug]/route';
import { FormSchema } from '@/lib/schema';
for (const slug of ['change-of-address', 'insurance-claim', 'medical-release'])
  test(`serves validated ${slug} without a model`, async () => {
    const result = await GET(new Request('http://localhost/api/demo/' + slug), {
      params: Promise.resolve({ slug }),
    });
    expect(result.status).toBe(200);
    expect(FormSchema.safeParse((await result.json()).schema).success).toBe(true);
  });
test('rejects traversal and unknown demo slugs', async () => {
  expect(
    (
      await GET(new Request('http://localhost/api/demo/x'), {
        params: Promise.resolve({ slug: '../../.env' }),
      })
    ).status,
  ).toBe(404);
});
