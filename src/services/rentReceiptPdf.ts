import PDFDocument from 'pdfkit';

// Recibo de un pago cobrado (art. 17.4 LAU: el arrendador entrega recibo y cada concepto va por separado).
export type ReceiptInput = {
  paymentId: string;
  type: 'rent' | 'deposit';
  amount: number;
  amountRefunded?: number;
  refundedAt?: Date | null;
  billingMonth?: number;
  billingYear?: number;
  paidAt?: Date | null;
  reference?: string;
  landlordName: string;
  tenantName: string;
  propertyAddress: string;
  propertyCity?: string;
};

export type ReceiptContent = {
  number: string;
  title: string;
  period: string | null;
  paidOn: string;
  rows: Array<[string, string]>;
  items: Array<[string, string]>;
  total: string;
  refund: string | null;
  footer: string;
  fileName: string;
};

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const money = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n).replace(/ /g, ' ');

const dateEs = (d: Date) =>
  new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(d);

/** «octubre de 2026» si el pago es de renta y tiene un mes válido; si no, `null`. */
export function rentPeriodLabel(
  type: string | undefined,
  billingMonth?: number | null,
  billingYear?: number | null,
): string | null {
  const valid =
    type === 'rent' &&
    Number.isInteger(billingMonth) &&
    Number.isInteger(billingYear) &&
    billingMonth! >= 1 &&
    billingMonth! <= 12;
  return valid ? `${MONTHS[billingMonth! - 1]} de ${billingYear}` : null;
}

/** Concepto de un cobro tal como sale en el recibo: «Fianza», «Renta de octubre de 2026» o «Renta». */
export function receiptConcept(type: string | undefined, billingMonth?: number | null, billingYear?: number | null) {
  if (type === 'deposit') return 'Fianza';
  const period = rentPeriodLabel(type, billingMonth, billingYear);
  return period ? `Renta de ${period}` : 'Renta';
}

export function describeReceipt(input: ReceiptInput): ReceiptContent {
  const period = rentPeriodLabel(input.type, input.billingMonth, input.billingYear);
  const hasPeriod = period !== null;
  const mm = hasPeriod ? String(input.billingMonth).padStart(2, '0') : '';
  const suffix = input.paymentId.slice(-6).toUpperCase();
  const number = hasPeriod ? `R-${input.billingYear}${mm}-${suffix}` : `R-${suffix}`;
  const concept = receiptConcept(input.type, input.billingMonth, input.billingYear);
  const address = [input.propertyAddress, input.propertyCity].filter(Boolean).join(', ');

  const rows: Array<[string, string]> = [
    ['Arrendador', input.landlordName],
    ['Arrendatario', input.tenantName],
    ['Vivienda', address],
  ];
  if (period) rows.push(['Periodo', period[0].toUpperCase() + period.slice(1)]);
  rows.push(['Fecha de pago', input.paidAt ? dateEs(input.paidAt) : '—']);
  rows.push(['Forma de pago', 'Pago electrónico a través de Stripe']);
  if (input.reference) rows.push(['Referencia', input.reference]);

  const refunded = Number(input.amountRefunded || 0);
  const refund =
    refunded > 0
      ? `Devuelto${input.refundedAt ? ` el ${dateEs(input.refundedAt)}` : ''}: ${money(refunded)}`
      : null;

  return {
    number,
    title: input.type === 'deposit' ? 'Recibo de fianza' : 'Recibo de renta',
    period,
    paidOn: input.paidAt ? dateEs(input.paidAt) : '—',
    rows,
    items: [[concept, money(input.amount)]],
    total: money(input.amount),
    refund,
    footer:
      'Justificante del pago emitido por RentalApp en nombre del arrendador ' +
      '(art. 17.4 de la Ley 29/1994, de Arrendamientos Urbanos).',
    fileName: `recibo_${number}.pdf`,
  };
}

const INK = '#16181d';
const MUTED = '#5b616e';
const LINE = '#e3e5e8';

export async function renderReceiptPdf(content: ReceiptContent): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: `${content.title} ${content.number}` } });
  const chunks: Buffer[] = [];
  doc.on('data', (d: Buffer) => chunks.push(d));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const rule = () => {
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.6).strokeColor(LINE).stroke();
  };

  doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('RentalApp', left, 56);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Nº ${content.number}`, left, 58, { width, align: 'right' });
  doc.moveDown(2.2);

  doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(content.title, left);
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(`Pagado el ${content.paidOn}`);
  doc.moveDown(1.2);
  rule();
  doc.moveDown(0.8);

  for (const [label, value] of content.rows) {
    const y = doc.y;
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(label, left, y, { width: 130 });
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(value, left + 140, y, { width: width - 140 });
    doc.moveDown(0.55);
  }

  doc.moveDown(0.6);
  rule();
  doc.moveDown(0.8);
  const headY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(MUTED).text('Concepto', left, headY);
  doc.text('Importe', left, headY, { width, align: 'right' });
  doc.moveDown(0.5);
  for (const [concept, amount] of content.items) {
    const y = doc.y;
    doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(concept, left, y, { width: width - 120 });
    doc.text(amount, left, y, { width, align: 'right' });
    doc.moveDown(0.5);
  }
  rule();
  doc.moveDown(0.6);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('Total pagado', left, y);
  doc.text(content.total, left, y, { width, align: 'right' });
  if (content.refund) {
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(content.refund, left, doc.y, { width, align: 'right' });
  }

  doc.moveDown(3);
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(content.footer, left, doc.y, { width });

  doc.end();
  return done;
}
