import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { FormSchema } from '@/lib/schema';
import { errorResponse, fail, privateHeaders } from '@/lib/errors';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const parsed = z
      .enum(['change-of-address', 'insurance-claim', 'medical-release'])
      .safeParse((await context.params).slug);
    if (!parsed.success) return fail(404, 'demo_not_found', 'This demo does not exist.');
    const data = await readFile(
      path.join(process.cwd(), 'public', 'demo-forms', `${parsed.data}.schema.json`),
      'utf8',
    );
    return Response.json(
      { schema: FormSchema.parse(JSON.parse(data)) },
      { headers: privateHeaders },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
