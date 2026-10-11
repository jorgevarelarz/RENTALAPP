import { Request, Response } from 'express';
import { Payment } from '../models/payment.model';
import { stripe } from '../utils/stripe';
import { Contract } from '../models/contract.model';
import { RESUMABLE_INTENT_STATUSES, STALE_CLAIM_MS } from '../services/rentPaymentAttempt.service';
import { Types } from 'mongoose';
import { User } from '../models/user.model';
import { Property } from '../models/property.model';
import { ensureCanReadContract, isActiveCoTenant } from '../utils/contractAccess';
import { describeReceipt, renderReceiptPdf } from '../services/rentReceiptPdf';
import { logger } from '../utils/logger';

/**
 * GET /api/payments/:id/receipt.pdf — recibo de una renta o fianza cobrada.
 * Lo descargan quien pagó, quien cobró y quien puede leer el contrato (casero, inquilino,
 * co-titular, agencia gestora o administrador).
 */
export const downloadReceipt = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const userId = user?.id ? String(user.id) : undefined;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  if (!Types.ObjectId.isValid(id)) return res.status(404).json({ error: 'receipt_not_found' });

  const payment = await Payment.findById(id).lean();
  if (!payment || (payment.type !== 'rent' && payment.type !== 'deposit') || !payment.contract) {
    return res.status(404).json({ error: 'receipt_not_found' });
  }

  const contractId = String(payment.contract);
  const isParty = String(payment.payer) === userId || String(payment.payee || '') === userId;
  if (!isParty && !(await isActiveCoTenant(contractId, userId))) {
    try {
      await ensureCanReadContract({ contractId, user });
    } catch (err: any) {
      // Un recibo ajeno se trata como inexistente.
      if (err?.status === 403 || err?.status === 404) return res.status(404).json({ error: 'receipt_not_found' });
      throw err;
    }
  }

  if (payment.status === 'refunded') return res.status(409).json({ error: 'receipt_refunded' });
  if (payment.status !== 'succeeded') return res.status(409).json({ error: 'receipt_not_paid' });

  const contract: any = await Contract.findById(contractId).select('landlord tenant property').lean();
  if (!contract) return res.status(404).json({ error: 'receipt_not_found' });
  const [landlord, tenant, property]: any[] = await Promise.all([
    User.findById(payment.payee || contract.landlord).select('name').lean(),
    User.findById(payment.payer).select('name').lean(),
    Property.findById(contract.property).select('address city').lean(),
  ]);

  const content = describeReceipt({
    paymentId: String(payment._id),
    type: payment.type,
    amount: Number(payment.amount),
    amountRefunded: payment.amountRefunded,
    refundedAt: payment.refundedAt,
    billingMonth: payment.billingMonth,
    billingYear: payment.billingYear,
    paidAt: payment.paidAt,
    reference: payment.stripeChargeId || payment.stripePaymentIntentId,
    landlordName: landlord?.name || 'Arrendador',
    tenantName: tenant?.name || 'Arrendatario',
    propertyAddress: property?.address || 'Vivienda',
    propertyCity: property?.city,
  });

  let pdf: Buffer;
  try {
    pdf = await renderReceiptPdf(content);
  } catch (err) {
    logger.error({ err, paymentId: id }, 'receipt_pdf_failed');
    return res.status(500).json({ error: 'receipt_pdf_failed' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${content.fileName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(pdf);
};

export const getMyPayments = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const payments = await Payment.find({
      $or: [{ payer: userId }, { payee: userId }],
    })
      .sort({ createdAt: -1 })
      .populate('contract', 'property')
      .lean();

    res.json(payments);
  } catch (error) {
    console.error('Error obteniendo pagos:', error);
    res.status(500).json({ message: 'Error al obtener pagos' });
  }
};

export const payReceipt = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ message: 'Recibo no encontrado' });
    }

    if (String(payment.payer) !== String(userId)) {
      return res.status(403).json({ message: 'No autorizado para pagar este recibo' });
    }

    if (payment.status === 'succeeded' || payment.status === 'refunded') {
      return res.status(400).json({ message: 'Este recibo ya esta pagado' });
    }

    // Si ya hay un intento abierto, se reanuda en lugar de crear otro PaymentIntent.
    if (payment.status === 'processing' && payment.stripePaymentIntentId) {
      const open = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
      if (open.status !== 'canceled') {
        if (!RESUMABLE_INTENT_STATUSES.has(open.status)) {
          return res.status(409).json({ message: 'El pago de este recibo ya esta en curso' });
        }
        return res.json({ clientSecret: open.client_secret, amount: payment.amount, currency: payment.currency });
      }
    }

    // Reclamo atómico: solo una petición crea el PaymentIntent.
    const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);
    const claimed = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        $or: [
          { status: { $in: ['pending', 'failed'] } },
          ...(payment.status === 'processing' && payment.stripePaymentIntentId
            ? [{ status: 'processing', stripePaymentIntentId: payment.stripePaymentIntentId }]
            : []),
          { status: 'processing', stripePaymentIntentId: null, updatedAt: { $lt: staleBefore } },
        ],
      },
      { $set: { status: 'processing' }, $unset: { stripePaymentIntentId: 1 } },
      { new: false },
    );
    if (!claimed) {
      return res.status(409).json({ message: 'El pago de este recibo ya esta en curso' });
    }

    const contract = payment.contract ? await Contract.findById(payment.contract) : null;

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(payment.amount * 100),
        currency: String(payment.currency || 'eur').toLowerCase(),
        customer: contract?.stripeCustomerId,
        automatic_payment_methods: { enabled: true },
        metadata: {
          contractId: contract?._id?.toString() || '',
          paymentId: payment._id.toString(),
          type: payment.type,
        },
      });
    } catch (err) {
      await Payment.updateOne(
        { _id: payment._id, status: 'processing', stripePaymentIntentId: null },
        { $set: { status: claimed.status === 'failed' ? 'failed' : 'pending' } },
      );
      throw err;
    }

    await Payment.updateOne(
      { _id: payment._id, status: 'processing' },
      { $set: { stripePaymentIntentId: paymentIntent.id } },
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: payment.amount,
      currency: payment.currency,
    });
  } catch (error: any) {
    console.error('Error iniciando pago:', error);
    res.status(500).json({ message: 'Error al procesar el pago', error: error.message });
  }
};
