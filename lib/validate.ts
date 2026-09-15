import {z} from 'zod';
import {RE2JS} from 're2js';
import type {Answers,Field,FormSchema} from './schema';
import {activeFields} from './next-field';
import type {MessageKey} from './i18n';
export type Validation={ok:boolean;code?:MessageKey;value?:string};
export function dateParts(value:string,format='MM/DD/YYYY'):[number,number,number]|null{
 let y:number,m:number,d:number;
 if(/^\d{4}-\d{2}-\d{2}$/.test(value)){[y,m,d]=value.split('-').map(Number);}else if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)){const p=value.split('/').map(Number);[y,m,d]=format==='DD/MM/YYYY'?[p[2],p[1],p[0]]:[p[2],p[0],p[1]];}else return null;
 if(y<1||y>9999||m<1||m>12||d<1||d>31)return null;const date=new Date(0);date.setUTCFullYear(y,m-1,d);date.setUTCHours(0,0,0,0);return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?[y,m,d]:null;
}
export function formatDate(value:string,format='MM/DD/YYYY'){const parts=dateParts(value,format);if(!parts)return value;const[y,m,d]=parts;return format==='YYYY-MM-DD'?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:format==='DD/MM/YYYY'?`${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`:`${String(m).padStart(2,'0')}/${String(d).padStart(2,'0')}/${y}`;}
export function today(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export function validate(field:Field,input:string,answers:Answers={},signedBy?:string):Validation{
 const value=input.trim();const bad=(code:MessageKey):Validation=>({ok:false,code});
 if(!value)return field.required?bad('invalid_required'):{ok:true,value:''};
 if(field.type==='signature')return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length>100&&value.length<=300000&&!!(signedBy??answers[field.id]?.signedBy)?.trim()?{ok:true,value}:bad('invalid_signature');
 if(value.length>(field.constraints?.maxLength??10000))return bad('invalid_length');
 if(field.type==='email'&&!z.string().email().safeParse(value).success)return bad('invalid_email');
 if(field.type==='date'&&!dateParts(value,field.constraints?.dateFormat))return bad('invalid_date');
 if(field.type==='phone'&&(!/^[+()\d .-]+$/.test(value)||value.replace(/\D/g,'').length<7||value.replace(/\D/g,'').length>20))return bad('invalid_phone');
 if(field.type==='number'&&(!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value)||!Number.isFinite(Number(value))||(field.constraints?.min!==undefined&&Number(value)<field.constraints.min)||(field.constraints?.max!==undefined&&Number(value)>field.constraints.max)))return bad('invalid_number');
 if(field.type==='select'&&!field.options?.includes(value))return bad('invalid_option');
 if(field.type==='multiselect'){try{const choices=z.array(z.string()).parse(JSON.parse(value));if(choices.some(v=>!field.options?.includes(v))||new Set(choices).size!==choices.length||field.required&&!choices.length)return bad('invalid_option');}catch{return bad('invalid_option');}}
 if(field.type==='checkbox'&&!['true','false'].includes(value))return bad('invalid_option');
 if(field.exclusiveWith?.some(id=>answers[id]?.status==='answered'&&answers[id].value==='true')&&value==='true')return bad('invalid_exclusive');
 if(field.constraints?.pattern){try{if(!RE2JS.compile(field.constraints.pattern).test(value))return bad('invalid_pattern');}catch{return bad('invalid_pattern');}}
 return {ok:true,value};
}
export function invalidFields(schema:FormSchema,answers:Answers){return activeFields(schema,answers).filter(field=>{const answer=answers[field.id];if(!answer||answer.status==='skipped')return field.required;return !validate(field,answer.value,answers).ok;});}
export const isSkipIntent=(value:string)=>/^(skip|skip this|i don'?t know|跳过|跳过这题|我不知道|不知道|omitir|no s[eé]|スキップ|わかりません)[.!。！]?$/i.test(value.trim());
export function needsTranslation(field:Field,value:string,uiLanguage:string,formLanguage:string){return ['text','textarea'].includes(field.type)&&!/(name|number|code|\bid\b|email|姓名|氏名)/i.test(field.label)&&uiLanguage.split('-')[0]!==formLanguage.split('-')[0]&&value.trim().length>0;}
