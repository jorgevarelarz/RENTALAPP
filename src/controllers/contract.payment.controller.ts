import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Contract } from '../models/contract.model';
import { ContractParty } from '../models/contractParty.model';
import { Payment } from '../models/payment.model';
import { RentPayment } from '../models/rentPayment.model';
import { stripe } from '../utils/stripe';
import { createPaymentIntent } from '../utils/payment';
import { depositToEscrow } from '../utils/deposit';
import { initiatePaymentAction } from '../services/contract.actions';
import { recordFunnelEvent } from '../services/funnelEvents.service';

export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const user = req.user;
    if (!user?.id || !user?.role) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const userRef = { id: String(user.id), role: String(user.role) };
    const clientSecret = await initiatePaymentAction(id, amount, userRef);
    await recordFunnelEvent(req, 'payment', {
      resourceType: 'contract',
      resourceId: id,
      meta: { amount, phase: 'initiated' },
    });
    res.json({ message: 'Pago iniciado', clientSecret });
  } catch (error: any) {
    console.error(error);
    if (error.message === 'Solo el inquilino puede iniciar pagos') {
      return res.status(403).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

export const payDeposit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { successUrl, cancelUrl } = req.body;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    if (contract.status !== 'active' && contract.status !== 'signed') {
      return res.status(400).json({ error: 'El contrato no está activo' });
    }
    const user = req.user;
    if (user?.role !== 'tenant' || String(contract.tenant) !== user?.id) {
      return res.status(403).json({ error: 'Solo el inquilino puede pagar la fianza' });
    }
    if (contract.depositPaid) {
      return res.status(400).json({ error: 'La fianza ya ha sido pagada' });
    }
    const depositAmount = contract.deposit;
    const sessionUrl = await depositToEscrow(
      contract.id,
      depositAmount,
      successUrl || process.env.DEPOSIT_SUCCESS_URL || 'https://example.com/deposit/success',
      cancelUrl || process.env.DEPOSIT_CANCEL_URL || 'https://example.com/deposit/cancel'
    );
    await recordFunnelEvent(req, 'payment', {
      resourceType: 'contract',
      resourceId: String(contract._id),
      meta: { amount: depositAmount, phase: 'deposit' },
    });
    res.json({ message: 'Iniciando pago de fianza', sessionUrl });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Error al pagar la fianza', details: error.message });
  }
};

export const createRentPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    const signedParty = await ContractParty.findOne({
      contractId: contract._id,
      role: 'TENANT',
      userId,
      status: 'SIGNED',
    });
    const legacyTenant = String(contract.tenant) === userId && contract.signedByTenant;
    if (!signedParty && !legacyTenant) {
      return res.status(403).json({ error: 'Solo los inquilinos firmantes pueden pagar la renta' });
    }
    if (contract.status !== 'active' && contract.status !== 'signed') {
      return res.status(400).json({ error: 'El contrato no está activo' });
    }

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let rentPayment = await RentPayment.findOne({ contractId: contract._id, period });
    if (rentPayment?.status === 'PAID') {
      return res.status(400).json({ error: 'ya_pagado' });
    }
    if (rentPayment?.status === 'PROCESSING') {
      return res.json({ status: rentPayment.status });
    }
    if (!rentPayment) {
      rentPayment = await RentPayment.create({
        contractId: contract._id,
        period,
        amount: contract.rent ?? (contract as any).rentAmount ?? 0,
        status: 'DUE',
      });
    }

    const monthName = now.toLocaleString('es-ES', { month: 'long' });
    const concept = `Renta ${monthName} ${now.getFullYear()}`;
    const amount = contract.rent ?? (contract as any).rentAmount ?? 0;
    const amountCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'eur',
      metadata: {
        type: 'rent',
        contractId: String(contract._id),
        payerId: String(userId),
        concept,
        rentPaymentId: String(rentPayment._id),
      },
      automatic_payment_methods: { enabled: true },
    });

    rentPayment.status = 'PROCESSING';
    rentPayment.providerPaymentId = paymentIntent.id;
    rentPayment.paidByUserId = userId ? new Types.ObjectId(userId) : undefined;
    await rentPayment.save();

    await Payment.create({
      contract: contract._id,
      payer: userId,
      payee: contract.landlord,
      amount,
      currency: 'eur',
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending',
      type: 'rent',
      concept,
      billingMonth: now.getMonth() + 1,
      billingYear: now.getFullYear(),
    });

    await recordFunnelEvent(req, 'payment', {
      resourceType: 'rentPayment',
      resourceId: String(rentPayment._id),
      meta: { contractId: String(contract._id), amount, period, phase: 'rent_intent' },
    });

    res.json({ clientSecret: paymentIntent.client_secret, amount });
  } catch (error: any) {
    console.error('Error creando pago de renta:', error);
    res.status(500).json({ error: 'Error al iniciar el pago' });
  }
};

export const payRentForPeriod = async (req: Request, res: Response) => {
  try {
    const { id, period } = req.params as { id: string; period: string };
    const userId = req.user?.id;
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: 'invalid_period' });
    }
    const month = Number(period.split('-')[1]);
    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'invalid_period' });
    }
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    const signedParty = await ContractParty.findOne({
      contractId: contract._id,
      role: 'TENANT',
      userId,
      status: 'SIGNED',
    });
    const legacyTenant = String(contract.tenant) === String(userId) && contract.signedByTenant;
    if (!signedParty && !legacyTenant) {
      return res.status(403).json({ error: 'Solo los inquilinos firmantes pueden pagar' });
    }
    let rentPayment = await RentPayment.findOne({ contractId: contract._id, period });
    if (rentPayment?.status === 'PAID') {
      return res.status(400).json({ error: 'ya_pagado' });
    }
    if (rentPayment?.status === 'PROCESSING') {
      return res.json({ status: rentPayment.status });
    }
    if (!rentPayment) {
      try {
        rentPayment = await RentPayment.create({
          contractId: contract._id,
          period,
          amount: contract.rent,
          status: 'DUE',
        });
      } catch (e: any) {
        if (e?.code === 11000) {
          rentPayment = await RentPayment.findOne({ contractId: contract._id, period });
        } else {
          throw e;
        }
      }
    }
    if (!rentPayment) {
      return res.status(500).json({ error: 'rent_payment_unavailable' });
    }
    if (!contract.stripeCustomerId) {
      return res.status(400).json({ error: 'Configuración de pago incompleta en el contrato.' });
    }
    const intent = await createPaymentIntent(contract.stripeCustomerId, contract.rent, contract.currency || 'eur', {
      metadata: {
        rentPaymentId: String(rentPayment._id),
        contractId: String(contract._id),
        period,
      },
    });
    rentPayment.status = 'PROCESSING';
    rentPayment.providerPaymentId = intent.id;
    rentPayment.paidByUserId = userId ? new Types.ObjectId(userId) : undefined;
    await rentPayment.save();
    await recordFunnelEvent(req, 'payment', {
      resourceType: 'rentPayment',
      resourceId: String(rentPayment._id),
      meta: { contractId: String(contract._id), amount: contract.rent, period, phase: 'rent_period' },
    });
    res.json({ clientSecret: intent.client_secret, amount: contract.rent, status: rentPayment.status });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'rent_payment_failed' });
  }
};
