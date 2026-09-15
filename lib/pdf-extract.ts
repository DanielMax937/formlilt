import { PDFDocument } from 'pdf-lib';
import { getDocumentProxy } from 'unpdf';
import { fileKind, MAX_FILE_BYTES, MAX_PAGES } from './files';
import type { PageMeta } from './schema';
export type TextItem = { str: string; x: number; y: number; w: number; h: number; size: number };
export type AcroField = { name: string; type: string; page: number; bbox: [number,number,number,number]; options?: string[] };
export type ParsedDocument = { source: 'pdf' | 'image'; pages: (PageMeta & { textItems: TextItem[] })[]; acroFields: AcroField[] };

export async function parseDocument(bytes: Uint8Array): Promise<ParsedDocument> {
  if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) throw new Error('File must be between 1 byte and 10 MB.');
  const kind = fileKind(bytes);
  if (!kind) throw new Error('Choose a PDF, JPEG or PNG file.');
  if (kind !== 'pdf') {
    const pdf = await PDFDocument.create();
    const image = kind === 'jpg' ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    if (image.width > 12000 || image.height > 12000 || image.width * image.height > 40000000) throw new Error('Image dimensions are too large.');
    return { source: 'image', pages: [{ index: 0, widthPt: image.width, heightPt: image.height, kind: 'scan', textItems: [] }], acroFields: [] };
  }
  const doc = await PDFDocument.load(bytes);
  if (doc.getPageCount() > MAX_PAGES) throw new Error('Choose a document with 15 pages or fewer.');
  if (doc.getPageCount() < 1) throw new Error('The PDF has no pages.');
  const proxy = await getDocumentProxy(new Uint8Array(bytes), { useSystemFonts: true });
  try {
    const pages: ParsedDocument['pages'] = [];
    for (let index = 0; index < proxy.numPages; index++) {
      const page = await proxy.getPage(index + 1);
      const view = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const textItems: TextItem[] = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const point = view.convertToViewportPoint(item.transform[4], item.transform[5]);
        const size = Math.hypot(item.transform[2], item.transform[3]) || item.height || 10;
        textItems.push({ str: item.str.slice(0,500), x: point[0], y: point[1] - size, w: item.width, h: item.height || size, size });
      }
      if (textItems.length > 15000) throw new Error('This page has too much text to process safely.');
      pages.push({ index, widthPt: view.width, heightPt: view.height, kind: textItems.length >= 20 ? 'text' : 'scan', textItems });
      page.cleanup();
    }
    const acroFields: AcroField[] = [];
    const form = doc.getForm();
    for (const field of form.getFields()) {
      for (const widget of field.acroField.getWidgets()) {
        const pageRef = widget.P();
        let pageIndex = doc.getPages().findIndex(p => pageRef && p.ref.toString() === pageRef.toString());
        if (pageIndex < 0) pageIndex = doc.getPages().findIndex(p => p.node.Annots()?.asArray().some(ref => doc.context.lookup(ref) === widget.dict));
        if (pageIndex < 0) continue;
        const rect = widget.getRectangle();
        const page = await proxy.getPage(pageIndex+1); const view = page.getViewport({ scale: 1 });
        const corners = [...view.convertToViewportPoint(rect.x, rect.y), ...view.convertToViewportPoint(rect.x+rect.width, rect.y+rect.height)];
        const bbox: AcroField['bbox'] = [Math.min(corners[0],corners[2])/view.width, Math.min(corners[1],corners[3])/view.height, Math.max(corners[0],corners[2])/view.width, Math.max(corners[1],corners[3])/view.height];
        const options = 'getOptions' in field && typeof field.getOptions === 'function' ? field.getOptions() as string[] : undefined;
        acroFields.push({ name: field.getName(), type: field.constructor.name, page: pageIndex, bbox, ...(options ? { options } : {}) });
      }
    }
    // XFA may coexist with usable AcroForm widgets. Only static/widget data is used; never run PDF JavaScript.
    return { source: 'pdf', pages, acroFields };
  } finally { await proxy.loadingTask.destroy(); }
}
