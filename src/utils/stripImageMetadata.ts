// Quita los metadatos de las imágenes subidas (EXIF con GPS, modelo de cámara,
// fecha, XMP, IPTC, comentarios) sin recodificar los píxeles.
// En JPEG se conserva solo la orientación, para que las fotos del móvil no
// salgan giradas. Si el fichero no se puede interpretar, se devuelve tal cual.

const JPEG_SOI = 0xd8;
const JPEG_SOS = 0xda;
const JPEG_APP1 = 0xe1; // EXIF / XMP
const JPEG_APP13 = 0xed; // Photoshop / IPTC
const JPEG_COM = 0xfe;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DROP = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

const WEBP_DROP = new Set(['EXIF', 'XMP ']);
const VP8X_EXIF_FLAG = 0x08;
const VP8X_XMP_FLAG = 0x04;

function readExifOrientation(segment: Buffer): number | undefined {
  // segment = contenido del APP1 sin la longitud: "Exif\0\0" + TIFF
  if (segment.length < 14 || segment.subarray(0, 6).toString('latin1') !== 'Exif\0\0') return undefined;
  const tiff = segment.subarray(6);
  const order = tiff.subarray(0, 2).toString('latin1');
  if (order !== 'II' && order !== 'MM') return undefined;
  const le = order === 'II';
  const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o: number) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return undefined;
  const count = u16(ifd);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return undefined;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : undefined;
    }
  }
  return undefined;
}

function orientationSegment(orientation: number): Buffer {
  // APP1 con un EXIF mínimo: TIFF big-endian, IFD0 con una sola entrada (Orientation)
  const body = Buffer.alloc(32);
  body.write('Exif\0\0', 0, 'latin1');
  body.write('MM', 6, 'latin1');
  body.writeUInt16BE(42, 8);
  body.writeUInt32BE(8, 10);
  body.writeUInt16BE(1, 14);
  body.writeUInt16BE(0x0112, 16);
  body.writeUInt16BE(3, 18); // SHORT
  body.writeUInt32BE(1, 20);
  body.writeUInt16BE(orientation, 24);
  body.writeUInt32BE(0, 28); // sin IFD siguiente
  const header = Buffer.from([0xff, JPEG_APP1, 0, 0]);
  header.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([header, body]);
}

function stripJpeg(input: Buffer): Buffer | undefined {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== JPEG_SOI) return undefined;
  const kept: Buffer[] = [];
  let orientation: number | undefined;
  let offset = 2;
  while (offset < input.length) {
    if (input[offset] !== 0xff) return undefined;
    const marker = input[offset + 1];
    if (marker === 0xff) { offset += 1; continue; } // relleno
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(input.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 4 > input.length) return undefined;
    const length = input.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > input.length) return undefined;
    if (marker === JPEG_SOS) {
      kept.push(input.subarray(offset)); // datos de imagen hasta el final
      break;
    }
    const isExif = marker === JPEG_APP1;
    if (isExif && orientation === undefined) {
      orientation = readExifOrientation(input.subarray(offset + 4, end));
    }
    if (!isExif && marker !== JPEG_APP13 && marker !== JPEG_COM) {
      kept.push(input.subarray(offset, end));
    }
    offset = end;
  }
  if (orientation && orientation !== 1) {
    // Tras el APP0 (JFIF) si lo hay, que debe ir primero
    const at = kept[0] && kept[0][1] === 0xe0 ? 1 : 0;
    kept.splice(at, 0, orientationSegment(orientation));
  }
  return Buffer.concat([input.subarray(0, 2), ...kept]);
}

function stripPng(input: Buffer): Buffer | undefined {
  if (input.length < 8 || !input.subarray(0, 8).equals(PNG_SIGNATURE)) return undefined;
  const kept: Buffer[] = [PNG_SIGNATURE];
  let offset = 8;
  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.subarray(offset + 4, offset + 8).toString('latin1');
    const end = offset + 12 + length;
    if (end > input.length) return undefined;
    if (!PNG_DROP.has(type)) kept.push(input.subarray(offset, end));
    offset = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(kept);
}

function stripWebp(input: Buffer): Buffer | undefined {
  if (
    input.length < 12 ||
    input.subarray(0, 4).toString('latin1') !== 'RIFF' ||
    input.subarray(8, 12).toString('latin1') !== 'WEBP'
  ) return undefined;
  const kept: Buffer[] = [];
  let offset = 12;
  while (offset + 8 <= input.length) {
    const type = input.subarray(offset, offset + 4).toString('latin1');
    const size = input.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (offset + 8 + size > input.length) return undefined;
    if (!WEBP_DROP.has(type)) {
      const chunk = Buffer.from(input.subarray(offset, Math.min(end, input.length)));
      if (type === 'VP8X' && chunk.length > 8) chunk[8] &= ~(VP8X_EXIF_FLAG | VP8X_XMP_FLAG);
      kept.push(chunk);
    }
    offset = end;
  }
  const body = Buffer.concat(kept);
  const header = Buffer.from('RIFF\0\0\0\0WEBP', 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  return Buffer.concat([header, body]);
}

export function stripImageMetadata(input: Buffer, ext: string): Buffer {
  try {
    const out =
      ext === 'jpg' ? stripJpeg(input)
        : ext === 'png' ? stripPng(input)
          : ext === 'webp' ? stripWebp(input)
            : undefined;
    return out ?? input;
  } catch {
    return input;
  }
}
