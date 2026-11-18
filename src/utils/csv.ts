// Excel, LibreOffice y Google Sheets ejecutan como fórmula una celda que empieza
// por estos caracteres (p. ej. `=HYPERLINK(...)`). Los números negativos no son
// fórmulas y se dejan tal cual para no romper importes como `-12.50`.
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/** Celda CSV entre comillas, neutralizando fórmulas con un apóstrofo delante. */
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}

export function csvRows(rows: unknown[][]): string {
  return rows.map(csvRow).join('\n');
}
