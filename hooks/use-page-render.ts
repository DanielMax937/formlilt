'use client';
import { useState } from 'react';
import { fittedSize, MAX_FILE_BYTES, MAX_PAGES } from '@/lib/files';
export type RenderedFile = { original: File; pages: File[] };
export async function renderFile(file: File, onProgress: (page: number, total: number) => void = () => {}): Promise<RenderedFile> {
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('Choose a file up to 10 MB.');
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/' });
    const pdf = await task.promise;
    try {
      if (pdf.numPages > MAX_PAGES) throw new Error('Choose a PDF with 15 pages or fewer.');
      const pages: File[] = [];
      for (let index = 1; index <= pdf.numPages; index++) {
        onProgress(index,pdf.numPages);
        const page = await pdf.getPage(index); const view = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 1600 / Math.max(view.width,view.height) });
        const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Cannot render this page.');
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        pages.push(new File([await jpeg(canvas)], `page-${index}.jpg`, { type: 'image/jpeg' }));
        canvas.width = 0; canvas.height = 0; page.cleanup();
      }
      return { original: file, pages };
    } finally { await pdf.destroy(); }
  }
  let blob: Blob = file;
  if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/.test(file.type)) {
    const { default: heic2any } = await import('heic2any'); const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: .8 }); blob = Array.isArray(converted) ? converted[0] : converted;
  } else if (!['image/jpeg','image/png'].includes(file.type)) throw new Error('Choose a PDF, JPG, PNG or HEIC image.');
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (image.naturalWidth * image.naturalHeight > 40000000) throw new Error('This image is too large.');
    const size = fittedSize(image.naturalWidth,image.naturalHeight);
    const canvas = document.createElement('canvas'); Object.assign(canvas, size);
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Cannot read this image.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,size.width,size.height); ctx.drawImage(image,0,0,size.width,size.height);
    const original = new File([await jpeg(canvas)], file.name.replace(/\.[^.]+$/, '')+'.jpg', { type: 'image/jpeg' });
    onProgress(1,1); return { original, pages: [original] };
  } finally { URL.revokeObjectURL(url); }
}
function jpeg(canvas: HTMLCanvasElement): Promise<Blob> { return new Promise((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not render page')), 'image/jpeg',.8)); }
export function usePageRender() {
  const [progress,setProgress] = useState({ page: 0, total: 0 });
  return { progress, render: (file: File) => renderFile(file,(page,total) => setProgress({ page,total })) };
}
