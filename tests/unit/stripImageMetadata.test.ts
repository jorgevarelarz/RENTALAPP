import { stripImageMetadata } from '../../src/utils/stripImageMetadata';

function seg(marker: number, body: Buffer) {
  const h = Buffer.from([0xff, marker, 0, 0]);
  h.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([h, body]);
}

// EXIF little-endian con Orientation=6 y un texto «GPS-SECRETO» que no debe quedar
function exifSegment(orientation: number) {
  const tiff = Buffer.alloc(40);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(orientation, 18);
  tiff.write('GPS-SECRETO', 26, 'latin1');
  return seg(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]));
}

const SCAN = Buffer.concat([seg(0xda, Buffer.from([1, 2, 3, 4])), Buffer.from([9, 9, 9, 0xff, 0xd9])]);

describe('stripImageMetadata', () => {
  it('JPEG: quita EXIF, XMP, IPTC y comentarios, conserva JFIF, ICC, imagen y orientación', () => {
    const app0 = seg(0xe0, Buffer.from('JFIF\0\x01\x01', 'latin1'));
    const icc = seg(0xe2, Buffer.from('ICC_PROFILE\0perfil', 'latin1'));
    const xmp = seg(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:autor>Ana</x:autor>', 'latin1'));
    const iptc = seg(0xed, Buffer.from('Photoshop 3.0\0IPTC-SECRETO', 'latin1'));
    const com = seg(0xfe, Buffer.from('COMENTARIO-SECRETO', 'latin1'));
    const input = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, exifSegment(6), xmp, iptc, icc, com, SCAN]);

    const out = stripImageMetadata(input, 'jpg');
    const text = out.toString('latin1');
    expect(text).not.toMatch(/SECRETO|autor|adobe/);
    expect(out.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    // APP0 sigue primero y la orientación va justo detrás
    expect(out.subarray(2, 2 + app0.length)).toEqual(app0);
    expect(out[2 + app0.length + 1]).toBe(0xe1);
    expect(text).toContain('ICC_PROFILE');
    expect(out.subarray(out.length - SCAN.length)).toEqual(SCAN);
    // Orientation=6 en el EXIF mínimo (big-endian)
    const exif = out.subarray(2 + app0.length + 4);
    expect(exif.subarray(0, 8).toString('latin1')).toBe('Exif\0\0MM');
    expect(exif.readUInt16BE(16)).toBe(0x0112);
    expect(exif.readUInt16BE(24)).toBe(6);
  });

  it('JPEG: sin orientación (o normal) no añade EXIF', () => {
    const input = Buffer.concat([Buffer.from([0xff, 0xd8]), exifSegment(1), SCAN]);
    const out = stripImageMetadata(input, 'jpg');
    expect(out).toEqual(Buffer.concat([Buffer.from([0xff, 0xd8]), SCAN]));
  });

  it('PNG: quita eXIf y textos, conserva el resto de bloques', () => {
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
    };
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = chunk('IHDR', Buffer.alloc(13));
    const idat = chunk('IDAT', Buffer.from([1, 2, 3]));
    const iend = chunk('IEND', Buffer.alloc(0));
    const input = Buffer.concat([
      sig, ihdr, chunk('tEXt', Buffer.from('Author\0SECRETO', 'latin1')),
      chunk('eXIf', Buffer.from('GPS-SECRETO', 'latin1')), idat, iend,
    ]);
    expect(stripImageMetadata(input, 'png')).toEqual(Buffer.concat([sig, ihdr, idat, iend]));
  });

  it('WebP: quita EXIF y XMP, apaga sus marcas en VP8X y corrige el tamaño RIFF', () => {
    const chunk = (type: string, data: Buffer) => {
      const size = Buffer.alloc(4);
      size.writeUInt32LE(data.length);
      const pad = data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0);
      return Buffer.concat([Buffer.from(type, 'latin1'), size, data, pad]);
    };
    const vp8xData = Buffer.alloc(10);
    vp8xData[0] = 0x08 | 0x04 | 0x10; // EXIF + XMP + alfa
    const vp8 = chunk('VP8 ', Buffer.from([1, 2, 3]));
    const body = Buffer.concat([
      chunk('VP8X', vp8xData), vp8, chunk('EXIF', Buffer.from('GPS-SECRETO', 'latin1')),
      chunk('XMP ', Buffer.from('<autor/>', 'latin1')),
    ]);
    const header = Buffer.from('RIFF\0\0\0\0WEBP', 'latin1');
    header.writeUInt32LE(body.length + 4, 4);

    const out = stripImageMetadata(Buffer.concat([header, body]), 'webp');
    expect(out.toString('latin1')).not.toMatch(/SECRETO|autor/);
    expect(out.readUInt32LE(4)).toBe(out.length - 8);
    expect(out[20]).toBe(0x10);
    expect(out.subarray(out.length - vp8.length)).toEqual(vp8);
  });

  it('devuelve el fichero intacto si no lo entiende', () => {
    const broken = Buffer.from([0xff, 0xd8, 0x00, 0x01, 0x02]);
    expect(stripImageMetadata(broken, 'jpg')).toBe(broken);
    const pdf = Buffer.from('%PDF-1.4');
    expect(stripImageMetadata(pdf, 'pdf')).toBe(pdf);
  });
});
