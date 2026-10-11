import { Request, Response } from 'express';
import { Payment } from '../models/payment.model';
import { stripe } from '../utils/stripe';
import { Contract } from '../models/contract.model';
import { RESUMABLE_INTENT_STATUSES, STALE_CLAIM_MS } from '../services/rentPaymentAttempt.service';

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
