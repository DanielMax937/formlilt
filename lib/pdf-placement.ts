import {StandardFonts,type PDFDocument,type PDFPage,concatTransformationMatrix,pushGraphicsState,popGraphicsState} from 'pdf-lib';
import type {Field} from './schema';
import {matchingLabel} from './extract-form';
import type {ParsedDocument} from './pdf-extract';
export type Box={x:number;y:number;width:number;height:number;size:number}; // displayed top-left coordinates
export async function fieldBox(doc:PDFDocument,field:Field,source:ParsedDocument):Promise<Box>{
 const anchor=field.anchor!;const page=source.pages[anchor.page];const hint=anchor.bbox;const box=hint?{x:hint[0]*page.widthPt,y:hint[1]*page.heightPt,width:(hint[2]-hint[0])*page.widthPt,height:(hint[3]-hint[1])*page.heightPt,size:10}:undefined;
 if(page.kind==='scan'){if(!box)throw new Error('Missing scan position.');return {...box,size:Math.min(24,box.height*.7)};}
 const label=matchingLabel(page.textItems,anchor.labelText??'',box?.y??0);if(!label)throw new Error('The field label cannot be located.');
 // A row/continuation or checkbox uses its bounded hint; matching source labels anchor the column/context.
 if(box&&(field.type==='checkbox'||Math.abs(box.y-label.y)>label.h*1.6||anchor.placement==='inbox'))return {...box,size:label.size*.9};
 const under=label.str.match(/_{3,}/);
 if(under&&under.index!==undefined){
  const metric=await doc.embedFont(StandardFonts.TimesRoman);let prefixWidth:number;
  try{prefixWidth=metric.widthOfTextAtSize(label.str.slice(0,under.index),label.size)/metric.widthOfTextAtSize(label.str,label.size)*label.w;}catch{prefixWidth=under.index/label.str.length*label.w;}
  // Multiple blanks in one text run (e.g. Yes ___ No ___) are disambiguated by the hint.
  if((label.str.match(/_{3,}/g)?.length??0)>1&&box)return {...box,y:label.y,size:label.size*.9};
  const x=label.x+prefixWidth+2;return {x,y:label.y,width:Math.max(8,label.x+label.w-x-2),height:label.h+2,size:label.size*.9};
 }
 const blank=page.textItems.filter(item=>/^_{3,}$/.test(item.str.trim())&&Math.abs(item.y-label.y)<3&&item.x>label.x).sort((a,b)=>a.x-b.x)[0];
 if(blank&&anchor.placement==='right')return {x:blank.x+2,y:blank.y,width:blank.w-4,height:blank.h+2,size:label.size*.9};
 if(box)return {...box,...(Math.abs(box.y-label.y)<label.h?{y:label.y}:{}),size:label.size*.9};
 const x=anchor.placement==='below'?label.x:label.x+label.w+5;const y=anchor.placement==='below'?label.y+label.h+3:label.y;
 const next=page.textItems.filter(item=>item.x>x&&Math.abs(item.y-y)<label.h).sort((a,b)=>a.x-b.x)[0];
 return {x,y,width:Math.max(8,(next?.x??page.widthPt-24)-x-5),height:label.h+3,size:label.size*.9};
}
/** Work in upright, displayed page coordinates even when the original has crop/rotation. */
export function inDisplayedPage(page:PDFPage,draw:()=>void){
 const crop=page.getCropBox();const angle=((page.getRotation().angle%360)+360)%360;
 const matrix:Record<number,[number,number,number,number,number,number]>={0:[1,0,0,1,crop.x,crop.y],90:[0,1,-1,0,crop.x+crop.width,crop.y],180:[-1,0,0,-1,crop.x+crop.width,crop.y+crop.height],270:[0,-1,1,0,crop.x,crop.y+crop.height]};
 if(!matrix[angle])throw new Error('Unsupported page rotation.');page.pushOperators(pushGraphicsState(),concatTransformationMatrix(...matrix[angle]));draw();page.pushOperators(popGraphicsState());
}
