// Igual que src/utils/csv.ts del backend: Excel, LibreOffice y Google Sheets ejecutan
// como fórmula una celda que empieza por = + - @ (p. ej. `=HYPERLINK(...)` en un User-Agent).
// Los números negativos no son fórmulas y se dejan tal cual.
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/** Celda CSV entre comillas, neutralizando fórmulas con un apóstrofo delante. */
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRows(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
