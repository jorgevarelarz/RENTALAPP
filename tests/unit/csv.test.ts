import { csvCell, csvRow, csvRows } from '../../src/utils/csv';

// Inyección de fórmulas en exportaciones CSV (auditoría de seguridad, medios).
describe('utils/csv', () => {
  it('neutraliza celdas que una hoja de cálculo ejecutaría como fórmula', () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe('"\'=HYPERLINK(""http://evil"",""x"")"');
    expect(csvCell('+34 600')).toBe('"\'+34 600"');
    expect(csvCell('-2+3')).toBe('"\'-2+3"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(csvCell('\tcmd')).toBe('"\'\tcmd"');
  });

  it('deja intactos los importes negativos y el texto normal', () => {
    expect(csvCell('-12.50')).toBe('"-12.50"');
    expect(csvCell(-3)).toBe('"-3"');
    expect(csvCell('Renta octubre')).toBe('"Renta octubre"');
    expect(csvCell('a=b')).toBe('"a=b"');
  });

  it('escapa comillas y trata null/undefined como vacío', () => {
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it('compone filas y documentos', () => {
    expect(csvRow(['a', 1])).toBe('"a","1"');
    expect(csvRows([['h1', 'h2'], ['=1', '2']])).toBe('"h1","h2"\n"\'=1","2"');
  });
});
