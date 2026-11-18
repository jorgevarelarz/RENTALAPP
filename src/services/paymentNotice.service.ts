import { Contract } from '../models/contract.model';
import { Payment } from '../models/payment.model';
import { Property } from '../models/property.model';
import { User } from '../models/user.model';
import { sendPaymentNoticeEmail } from '../utils/email';
import { logger } from '../utils/logger';
import { receiptConcept } from './rentReceiptPdf';

type PaymentRef = { _id: unknown } | { stripePaymentIntentId: string };

/**
 * Avisa por correo de un pago cobrado: justificante a quien paga y, si es renta o fianza, aviso del
 * cobro al casero. Se llama una sola vez por pago (cuando pasa a cobrado). Nunca lanza.
 */
export async function notifyPaymentSucceeded(ref: PaymentRef): Promise<void> {
  try {
    const payment = await Payment.findOne({ ...ref, status: 'succeeded' }).lean();
    if (!payment) return;
    const rental = payment.type === 'rent' || payment.type === 'deposit';
    const [payer, payee, contract] = await Promise.all([
      User.findById(payment.payer).select('name email').lean(),
      payment.payee ? User.findById(payment.payee).select('name email').lean() : null,
      payment.contract ? Contract.findById(payment.contract).select('property').lean() : null,
    ]);
    const property = contract?.property
      ? await Property.findById(contract.property).select('title address city').lean()
      : null;
    const notice = {
      concept: rental ? receiptConcept(payment.type, payment.billingMonth, payment.billingYear) : payment.concept,
      amount: payment.amount,
      paidAt: payment.paidAt || new Date(),
      contractId: payment.contract ? String(payment.contract) : undefined,
      hasReceipt: rental,
      propertyTitle: property?.title,
      propertyAddress: [property?.address, property?.city].filter(Boolean).join(', '),
    };
    const sends: Promise<unknown>[] = [];
    if (payer?.email) {
      sends.push(sendPaymentNoticeEmail(payer.email, { ...notice, audience: 'payer', name: payer.name }));
    }
    if (rental && payee?.email && String(payee._id) !== String(payer?._id)) {
      sends.push(
        sendPaymentNoticeEmail(payee.email, { ...notice, audience: 'payee', name: payee.name, payerName: payer?.name }),
      );
    }
    await Promise.all(sends);
  } catch (err) {
    logger.error({ type: 'payment_notice_error', err }, 'No se pudo avisar del cobro');
  }
}
