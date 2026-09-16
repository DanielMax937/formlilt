export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PAGES = 15;
export const MAX_PAGE_EDGE = 1600;
export function fileKind(bytes: Uint8Array): 'pdf' | 'jpg' | 'png' | null {
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
    return 'pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'png';
  return null;
}
export function fittedSize(width: number, height: number, maxEdge = MAX_PAGE_EDGE) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('Invalid page dimensions');
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
export function pngDimensions(bytes: Uint8Array) {
  if (
    fileKind(bytes) !== 'png' ||
    bytes.length < 24 ||
    new TextDecoder().decode(bytes.slice(12, 16)) !== 'IHDR'
  )
    throw new Error('Invalid PNG image.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16),
    height = view.getUint32(20);
  if (!width || !height) throw new Error('Invalid image dimensions.');
  return { width, height };
}
