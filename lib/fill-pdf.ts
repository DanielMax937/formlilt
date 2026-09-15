import {PDFDocument,PDFTextField,PDFCheckBox,PDFRadioGroup,PDFDropdown,PDFOptionList,PDFName,PDFRef,rgb,TextAlignment,type PDFFont,type PDFPage} from 'pdf-lib';
import {FormSchema,Answers,type Field} from './schema';
import {parseDocument} from './pdf-extract';
import {groundSchema} from './extract-form';
import {activeFields,pruneAnswers} from './next-field';
import {formatDate,invalidFields} from './validate';
import {pdfFonts,fontFamily} from './fonts';
import {fieldBox,inDisplayedPage,type Box} from './pdf-placement';
import {fileKind,pngDimensions} from './files';
import {fail} from './errors';
const ink=rgb(.08,.15,.24);
function wrap(text:string,font:PDFFont,size:number,width:number):string[]{const lines:string[]=[];for(const paragraph of text.split(/\r?\n/)){let line='';for(const char of paragraph){if(line&&font.widthOfTextAtSize(line+char,size)>width){lines.push(line.trimEnd());line='';}line+=char;}lines.push(line.trimEnd());}return lines;}
function fit(text:string,font:PDFFont,box:Box,multiline:boolean){let size=Math.max(7,Math.min(32,box.size,box.height*.8));let lines=multiline?wrap(text,font,size,box.width):[text.replace(/\s*\n\s*/g,' ')];while(size>7&&(lines.some(line=>font.widthOfTextAtSize(line,size)>box.width)||lines.length*size*1.18>box.height+2)){size=Math.max(7,size-.25);lines=multiline?wrap(text,font,size,box.width):lines;}
 if(lines.some(line=>font.widthOfTextAtSize(line,size)>box.width+.2)||lines.length*size*1.18>box.height+3)throw new Error('The answer is too long to fit. Shorten it in the review page.');return {size,lines};}
function drawText(page:PDFPage,text:string,font:PDFFont,box:Box,pageHeight:number,multiline:boolean){const {size,lines}=fit(text,font,box,multiline);inDisplayedPage(page,()=>{lines.forEach((line,i)=>{const rtl=fontFamily(line)==='arabic';page.drawText(line,{font,size,color:ink,x:box.x+(rtl?Math.max(0,box.width-font.widthOfTextAtSize(line,size)):0),y:pageHeight-box.y-size-i*size*1.18});});});}
function sanitize(doc:PDFDocument){doc.catalog.delete(PDFName.of('OpenAction'));doc.catalog.delete(PDFName.of('AA'));for(const page of doc.getPages()){page.node.delete(PDFName.of('AA'));for(const annotation of page.node.Annots()?.asArray()??[]){const dictionary=doc.context.lookup(annotation);if(dictionary&&'delete' in dictionary&&typeof dictionary.delete==='function'){dictionary.delete(PDFName.of('AA'));}}}}
export async function fillPdf(original:Uint8Array,rawSchema:FormSchema,rawAnswers:Answers,lock=false):Promise<Uint8Array>{
 const supplied=FormSchema.parse(rawSchema);const parsedAnswers=Answers.parse(rawAnswers);let source;
 try{source=await parseDocument(original);}catch(error){return fail(400,'upload_rejected',error instanceof Error?error.message:'This file cannot be opened.');}
 if(source.source!==supplied.source||source.pages.length!==supplied.pages.length||source.pages.some((p,i)=>Math.abs(p.widthPt-supplied.pages[i].widthPt)>1||Math.abs(p.heightPt-supplied.pages[i].heightPt)>1))return fail(400,'invalid_input','The original file does not match this form.');
 let schema:FormSchema;try{schema=groundSchema(supplied,source);}catch{return fail(400,'invalid_input','Some fields do not match the original document.');}
 const answers=pruneAnswers(schema,parsedAnswers);if(invalidFields(schema,answers).length)return fail(400,'invalid_required','Complete or correct the required answers before downloading.');
 const doc=source.source==='pdf'?await PDFDocument.load(original):await PDFDocument.create();
 if(source.source==='image'){const image=fileKind(original)==='jpg'?await doc.embedJpg(original):await doc.embedPng(original);doc.addPage([image.width,image.height]).drawImage(image,{x:0,y:0,width:image.width,height:image.height});}
 sanitize(doc);const form=doc.getForm();const getFont=pdfFonts(doc);const nativeFields=new Map(form.getFields().map(field=>[field.getName(),field]));
 for(const field of activeFields(schema,answers)){
  const answer=answers[field.id];if(answer?.status!=='answered'||!answer.value)continue;
  const native=field.acroName?nativeFields.get(field.acroName):undefined;const anchor=field.anchor!;const page=doc.getPage(anchor.page);const pageHeight=source.pages[anchor.page].heightPt;
  try{
   if(field.type==='signature'){
    const png=Buffer.from(answer.value.split(',')[1],'base64');const dimensions=pngDimensions(png);if(dimensions.width>2000||dimensions.height>1000)throw new Error('The signature image dimensions are invalid.');const image=await doc.embedPng(png);if(image.width>2000||image.height>1000||image.width<10||image.height<5)throw new Error('The signature image dimensions are invalid.');
    if(native instanceof PDFTextField){native.setText(answer.signedBy);native.setImage(image);continue;}
    const boxes=native?source.acroFields.filter(a=>a.name===native.getName()).map(a=>({page:a.page,box:{x:a.bbox[0]*source.pages[a.page].widthPt,y:a.bbox[1]*source.pages[a.page].heightPt,width:(a.bbox[2]-a.bbox[0])*source.pages[a.page].widthPt,height:(a.bbox[3]-a.bbox[1])*source.pages[a.page].heightPt,size:10}})):[{page:anchor.page,box:await fieldBox(doc,field,source)}];
    if(native){const widgets=native.acroField.getWidgets();for(const p of doc.getPages())for(const ref of [...(p.node.Annots()?.asArray()??[])])if(ref instanceof PDFRef&&(ref===native.ref||widgets.some(widget=>doc.context.lookup(ref)===widget.dict)))p.node.removeAnnot(ref);form.acroForm.removeField(native.acroField);form.markFieldAsClean(native.ref);}
    for(const location of boxes){const box=location.box;const size=image.scaleToFit(box.width,box.height+2);inDisplayedPage(doc.getPage(location.page),()=>doc.getPage(location.page).drawImage(image,{x:box.x,y:source.pages[location.page].heightPt-box.y-box.height,width:size.width,height:size.height}));}continue;
   }
   let value=field.type==='date'?formatDate(answer.value,field.constraints?.dateFormat):answer.value;
   if(native instanceof PDFCheckBox){value==='true'?native.check():native.uncheck();native.updateAppearances();continue;}
   if(native instanceof PDFRadioGroup){native.select(value);native.updateAppearances();continue;}
   if(native instanceof PDFDropdown||native instanceof PDFOptionList){const choices=field.type==='multiselect'?JSON.parse(value) as string[]:value;native.select(choices);native.updateAppearances(await getFont(Array.isArray(choices)?choices.join(' '):choices));continue;}
   if(field.type==='checkbox'){if(value==='false')continue;value='X';}
   if(field.type==='multiselect')value=(JSON.parse(value) as string[]).join(', ');
   const font=await getFont(value);
   if(native instanceof PDFTextField){
    const rects=native.acroField.getWidgets().map(widget=>widget.getRectangle());const width=Math.min(...rects.map(r=>r.width))-5;const height=Math.min(...rects.map(r=>r.height))-3;
    if(field.type==='textarea'&&(value.includes('\n')||font.widthOfTextAtSize(value,Math.min(11,height*.8))>width))native.enableMultiline();let size=fit(value,font,{x:0,y:0,width,height,size:11},native.isMultiline()).size;
    if(native.isMultiline()){while(size>7&&wrap(value,font,size,width).length*font.heightAtSize(size)*1.2>height-1)size=Math.max(7,size-.25);if(wrap(value,font,size,width).length*font.heightAtSize(size)*1.2>height)throw new Error('The answer is too long to fit. Shorten it in the review page.');}
    const appearance=`/${font.name} ${size} Tf 0.08 0.15 0.24 rg`;native.acroField.setDefaultAppearance(appearance);for(const widget of native.acroField.getWidgets())widget.setDefaultAppearance(appearance);
    native.setText(value);native.setFontSize(size);native.setAlignment(fontFamily(value)==='arabic'?TextAlignment.Right:TextAlignment.Left);native.updateAppearances(font);continue;
   }
   if(native)throw new Error('This native field type cannot be filled.');
   const box=await fieldBox(doc,field,source);if(box.x<0||box.y<0||box.x+box.width>source.pages[anchor.page].widthPt+1||box.y+box.height>pageHeight+1)throw new Error('The answer position is outside the page.');
   drawText(page,value,font,box,pageHeight,field.type==='textarea');
  }catch(error){return fail(400,'fill_value_error',`${field.label}: ${error instanceof Error?error.message:'This answer could not be placed.'}`);}
 }
 form.updateFieldAppearances(await getFont(''));if(lock)form.flatten({updateFieldAppearances:false});doc.setProducer('FillFlow · pdf-lib');
 return doc.save({updateFieldAppearances:false});
}
