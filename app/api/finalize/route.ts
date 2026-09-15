import {isKnownDemo} from '@/lib/known-demo';
import {z} from 'zod';
import {FinalizeInput} from '@/lib/schema';
import {fillPdf} from '@/lib/fill-pdf';
import {generateValidated} from '@/lib/llm';
import {plainSummary} from '@/lib/summary';
import {summaryPrompt} from '@/prompts/summary';
import {enforceLimit} from '@/lib/rate-limit';
import {errorResponse,fail,privateHeaders,readMultipart,sameOrigin} from '@/lib/errors';
export const runtime='nodejs';export const preferredRegion='hkg1';export const maxDuration=60;
export async function POST(request:Request){try{
 sameOrigin(request);const form=await readMultipart(request);const file=form.get('original');const payload=form.get('payload');if(!(file instanceof File)||typeof payload!=='string'||payload.length>2_000_000)return fail(400,'invalid_input','The original file and form answers are required.');
 let json:unknown;try{json=JSON.parse(payload);}catch{return fail(400,'invalid_input','The form answers could not be read.');}const input=FinalizeInput.parse(json);const demo=await isKnownDemo(input.schema);if(!demo)await enforceLimit(request,'finalize');
 const pdf=await fillPdf(new Uint8Array(await file.arrayBuffer()),input.schema,input.answers,input.lock);
 const fallback=plainSummary(input.schema,input.answers,input.uiLanguage);
 // The PDF remains downloadable even when the model service is slow or unavailable.
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(1800)]);
 const summary=demo?fallback:await generateValidated(z.object({summary:z.string().max(150)}),[{role:'user',content:summaryPrompt(input.schema,input.answers,input.uiLanguage)}],undefined,signal,1).then(result=>result.summary).catch(()=>fallback);
 return new Response(new Uint8Array(pdf),{headers:{...privateHeaders,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="fillflow-filled.pdf"','X-Summary':encodeURIComponent(summary)}});
}catch(error){if(error instanceof Error&&!('status' in error))return errorResponse({status:500,code:'finalize_error',message:'The PDF could not be generated. You can still export JSON or copy the text summary.'});return errorResponse(error);}}
