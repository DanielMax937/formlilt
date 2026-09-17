import { isDemoOnly } from '@/lib/deployment';
import { extractForm } from '@/lib/extract-form';
import { errorResponse, fail, privateHeaders, readMultipart, sameOrigin } from '@/lib/errors';
import { enforceLimit } from '@/lib/rate-limit';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (isDemoOnly())
      return fail(
        503,
        'demoMode',
        'Uploads are not enabled in this preview. Please choose a sample form.',
      );
    const data = await readMultipart(request);
    const original = data.get('original');
    const pages = data.getAll('pages[]');
    if (
      !(original instanceof File) ||
      pages.some((p) => !(p instanceof File)) ||
      pages.length < 1 ||
      pages.length > 15
    )
      return fail(400, 'upload_rejected', 'Choose a file with 1 to 15 pages.');
    // Validate before consuming quota. Extraction repeats parsing to keep its standalone contract safe.
    const { parseDocument } = await import('@/lib/pdf-extract');
    const bytes = new Uint8Array(await original.arrayBuffer());
    try {
      await parseDocument(bytes);
    } catch (e) {
      return fail(
        400,
        'upload_rejected',
        e instanceof Error ? e.message : 'This file cannot be opened.',
      );
    }
    await enforceLimit(request, 'extract');
    const schema = await extractForm(
      bytes,
      await Promise.all((pages as File[]).map(async (p) => new Uint8Array(await p.arrayBuffer()))),
      request.signal,
    );
    return Response.json({ schema }, { headers: privateHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
