import {isKnownDemo} from '@/lib/known-demo';
import {z} from 'zod';
import {TurnInput,TurnResult} from '@/lib/schema';
import {activeFields,applyAnswer,nextField} from '@/lib/next-field';
import {isSkipIntent,needsTranslation,validate} from '@/lib/validate';
import {attachSignature} from '@/lib/signature';
import {t} from '@/lib/i18n';
import {errorResponse,fail,privateHeaders,readJson,sameOrigin} from '@/lib/errors';
import {enforceLimit} from '@/lib/rate-limit';
import {streamValidated} from '@/lib/llm';
import {turnPrompt} from '@/prompts/turn';
export const runtime='nodejs';export const preferredRegion='hkg1';export const maxDuration=60;
const Wording=z.object({question:z.string().max(1000),explanation:z.string().max(1500).optional(),normalizedValue:z.string().max(10000).optional()});
export async function POST(request:Request){try{
 sameOrigin(request);const input=TurnInput.parse(await readJson(request));
 const field=activeFields(input.schema,input.answers).find(f=>f.id===input.currentFieldId);if(!field)return fail(400,'invalid_input','This question is not available.');
 const action=input.action==='answer'&&isSkipIntent(input.input??'')?'skip':input.action;
 const validation=action==='answer'?validate(field,input.input??'',input.answers,input.signedBy):{ok:true};
 if(!validation.ok)return Response.json(TurnResult.parse({validation:{ok:false,message:t(input.uiLanguage,validation.code!)},nextFieldId:field.id,question:`${t(input.uiLanguage,'question')} ${field.label}`,done:false}),{headers:privateHeaders});
 let answers=action==='answer'||action==='skip'?applyAnswer(input.schema,input.answers,field.id,action==='skip'?'':input.input??'',action==='skip'?'skipped':'answered'):input.answers;
 if(action==='answer')answers=attachSignature(input.schema,answers,field,input.signedBy);
 let next:string|null;try{next=nextField(input.schema,answers,field.id,action,input.targetFieldId);}catch{return fail(400,'invalid_input','This question is not available.');}
 const nextItem=input.schema.fields.find(f=>f.id===next);
 const baseline:TurnResult={validation:{ok:true},nextFieldId:next,question:nextItem?`${t(input.uiLanguage,'question')} ${nextItem.label}`:t(input.uiLanguage,'done'),done:next===null,...(action==='explain'?{explanation:field.help||t(input.uiLanguage,'unknownHelp')}:{})};
 const translate=action==='answer'&&!input.confirmed&&needsTranslation(field,input.input??'',input.uiLanguage,input.schema.language);
 const translateHelp=action==='explain'&&!!field.help&&input.uiLanguage.split('-')[0]!==input.schema.language.split('-')[0];
 if(translate||translateHelp||!(await isKnownDemo(input.schema)))await enforceLimit(request,'turn');
 const encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({async start(controller){const send=(value:unknown)=>controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));
  try{
   if(!translate)send({type:'result',data:baseline});else send({type:'pending'});
   if(translate||translateHelp){
    const messages=[{role:'user' as const,content:turnPrompt({field,action:translate?'translation':'explain',input:translate?input.input:undefined,uiLanguage:input.uiLanguage,formLanguage:input.schema.language})}];
    for await(const part of streamValidated(Wording,messages,request.signal)){
     if('partial' in part){const parsed=Wording.partial().safeParse(part.partial);if(parsed.success)send({type:'wording',data:parsed.data});}
     else{const normalized=part.result.normalizedValue;if(translate&&normalized!==undefined&&!validate(field,normalized,answers).ok)return fail(502,'llm_schema_fail','The translated value does not fit this field.');
      send({type:'result',data:{...baseline,question:part.result.question,...(translate?{nextFieldId:field.id,done:false,validation:{ok:true,normalizedValue:normalized??input.input}}:{explanation:part.result.explanation||baseline.explanation})}});}
    }
   }
  }catch(error){const response=errorResponse(error);send({type:'error',...(await response.json())});}finally{controller.close();}
 }});
 return new Response(stream,{headers:{...privateHeaders,'Content-Type':'application/x-ndjson; charset=utf-8'}});
}catch(error){return errorResponse(error);}}
