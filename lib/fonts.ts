import {readFile} from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import {PDFDocument,type PDFFont} from 'pdf-lib';
const paths={latin:'NotoSans-Regular.ttf',cjk:'NotoSansCJKsc-Regular.ttf',arabic:'NotoSansArabic-Regular.ttf'} as const;
const bytes=new Map<string,Promise<Buffer>>();
export function fontFamily(text:string):keyof typeof paths{return /[\u0600-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u.test(text)?'arabic':/[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\u3040-\u30ff\uff00-\uffef]/u.test(text)?'cjk':'latin';}
export function pdfFonts(doc:PDFDocument){
 doc.registerFontkit(fontkit);const fonts=new Map<string,Promise<PDFFont>>();
 return async(text:string)=>{const family=fontFamily(text);if(!fonts.has(family)){if(!bytes.has(family))bytes.set(family,readFile(path.join(process.cwd(),'public','fonts',paths[family])));fonts.set(family,bytes.get(family)!.then(data=>doc.embedFont(data,{subset:true})));}const font=await fonts.get(family)!;const supported=new Set(font.getCharacterSet());if([...text].some(char=>!/[\n\r\t]/.test(char)&&!supported.has(char.codePointAt(0)!)))throw new Error('Some characters are not supported by the embedded font.');return font;};
}
