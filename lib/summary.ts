import type {Answers,FormSchema,UILanguage} from './schema';
import {activeFields} from './next-field';
export function plainSummary(schema:FormSchema,answers:Answers,language:UILanguage):string{
 const fields=activeFields(schema,answers);const count=fields.filter(f=>answers[f.id]?.status==='answered'&&answers[f.id].value).length;const skipped=fields.filter(f=>!answers[f.id]?.value).map(f=>f.label).join(', ');
 const title=schema.title.slice(0,60);const base=language==='zh-CN'?`${title}：已填写 ${count} 项。${skipped?'未填写：'+skipped:'请对照原表检查后提交。'}`:language==='ja'?`${title}：${count} 項目を記入。${skipped?'未記入：'+skipped:'元の書類と照合して提出してください。'}`:language==='es'?`${title}: ${count} respuestas. ${skipped?'Sin responder: '+skipped:'Revisa el PDF antes de entregarlo.'}`:`${title}: ${count} answers entered. ${skipped?'Not entered: '+skipped:'Check the PDF before submitting.'}`;
 return [...base].length>150?[...base].slice(0,149).join('')+'…':base;
}
