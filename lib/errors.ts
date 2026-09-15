import { z } from 'zod';
export type AppError = { status: number; code: string; message: string };
export const fail = (status: number, code: string, message: string): never => { throw { status, code, message } satisfies AppError; };
export const privateHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) return Response.json({ error: { code: 'invalid_input', message: 'The form data is invalid. Please check it and try again.' } }, { status: 400, headers: privateHeaders });
  const parsed = z.object({ status: z.number().int().min(400).max(599), code: z.string(), message: z.string() }).safeParse(error);
  const result = parsed.success ? parsed.data : { status: 500, code: 'internal_error', message: 'Something went wrong. Please try again.' };
  return Response.json({ error: { code: result.code, message: result.message } }, { status: result.status, headers: privateHeaders });
}
export async function limitedBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get('content-length')) > maxBytes) fail(400,'upload_rejected','This request is too large. Choose a smaller file.');
  if (!request.body) fail(400,'invalid_input','A request body is required.');
  const reader = request.body!.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) { await reader.cancel(); fail(400,'upload_rejected','This request is too large. Choose a smaller file.'); } chunks.push(value); } } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { result.set(chunk,offset); offset += chunk.length; } return result;
}
export async function readMultipart(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) fail(400,'invalid_input','A file upload is required.');
  const bytes = await limitedBody(request,18*1024*1024);
  try { return await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData(); } catch { return fail(400,'invalid_input','The upload could not be read.'); }
}
export async function readJson(request: Request) { const bytes = await limitedBody(request,750000); try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; } catch { return fail(400,'invalid_input','Invalid JSON.'); } }
export function sameOrigin(request: Request) {
 const origin=request.headers.get('origin');if(!origin)return;const url=new URL(request.url);const host=request.headers.get('host');
 // Next's development adapter may use localhost in request.url while the browser uses 127.0.0.1.
 const permitted=[url.origin,...(host?[`${url.protocol}//${host}`]:[])];
 if(!permitted.includes(origin))fail(403,'invalid_origin','Please use the form on this website.');
}
