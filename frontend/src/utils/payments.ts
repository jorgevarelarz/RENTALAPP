import { downloadReceipt } from '../services/payments';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

type TitledPayment = {
  type?: 'rent' | 'deposit' | 'service' | 'settlement';
  concept?: string;
  billingMonth?: number;
  billingYear?: number;
};

export function paymentTitle(p: TitledPayment) {
  if (p.type === 'deposit') return 'Fianza';
  if (p.type === 'rent' && p.billingMonth && p.billingMonth >= 1 && p.billingMonth <= 12 && p.billingYear) {
    return `Renta de ${MONTHS[p.billingMonth - 1]} de ${p.billingYear}`;
  }
  return p.concept || 'Recibo de renta';
}

/** Descarga el recibo PDF de un pago cobrado (`GET /api/payments/:id/receipt.pdf`). */
export async function saveReceiptPdf(token: string, payment: TitledPayment & { _id: string }) {
  const blob = await downloadReceipt(token, payment._id);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `recibo_${paymentTitle(payment).toLowerCase().replace(/\s+/g, '_')}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
