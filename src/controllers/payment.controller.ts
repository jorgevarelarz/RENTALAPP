import { Request, Response } from 'express';
import { Payment } from '../models/payment.model';
import { stripe } from '../utils/stripe';
import { Contract } from '../models/contract.model';

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

    if (payment.status === 'succeeded') {
      return res.status(400).json({ message: 'Este recibo ya esta pagado' });
    }

    const contract = payment.contract ? await Contract.findById(payment.contract) : null;

    const paymentIntent = await stripe.paymentIntents.create({
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

    payment.stripePaymentIntentId = paymentIntent.id;
    payment.status = 'processing';
    await payment.save();

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
