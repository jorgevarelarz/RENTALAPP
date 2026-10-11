import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Contract } from '../models/contract.model';
import { ContractParty } from '../models/contractParty.model';
import { Payment } from '../models/payment.model';
import {
  attachRentIntent,
  claimRentPayment,
  ensureRentPayment,
  releaseRentClaim,
} from '../services/rentPaymentAttempt.service';
import { stripe } from '../utils/stripe';
import { createPaymentIntent } from '../utils/payment';
import { depositToEscrow, getDepositCheckout } from '../utils/deposit';
import { frontendUrl } from '../utils/frontendUrl';
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
    const contract = await Contract.findById(id).select('+depositCheckoutSessionId');
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

    // Mientras la sesión anterior siga abierta se reutiliza: una sola fianza por contrato.
    const previousSessionId = contract.depositCheckoutSessionId;
    if (previousSessionId) {
      const previous = await getDepositCheckout(previousSessionId);
      if (previous.status === 'open' && previous.url) {
        return res.json({ message: 'Iniciando pago de fianza', sessionUrl: previous.url });
      }
      if (previous.status === 'complete') {
        return res.status(409).json({ error: 'La fianza ya se ha pagado y se está confirmando' });
      }
    }

    // Las URLs de vuelta las fija el servidor, no el cliente.
    const depositAmount = contract.deposit;
    const session = await depositToEscrow(
      contract.id,
      depositAmount,
      process.env.DEPOSIT_SUCCESS_URL || frontendUrl(`/contracts/${contract.id}`, { deposit: 'success' }),
      process.env.DEPOSIT_CANCEL_URL || frontendUrl(`/contracts/${contract.id}`, { deposit: 'cancel' }),
      // Peticiones simultáneas con el mismo estado comparten clave y reciben la misma sesión.
      `deposit:${contract.id}:${previousSessionId || 'first'}`,
    );
    await Contract.updateOne(
      { _id: contract._id, depositCheckoutSessionId: previousSessionId ?? null },
      { $set: { depositCheckoutSessionId: session.id } },
    );
    await recordFunnelEvent(req, 'payment', {
      resourceType: 'contract',
      resourceId: String(contract._id),
      meta: { amount: depositAmount, phase: 'deposit' },
    });
    res.json({ message: 'Iniciando pago de fianza', sessionUrl: session.url });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Error al pagar la fianza' });
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
    const amount = contract.rent ?? (contract as any).rentAmount ?? 0;
    const existing = await ensureRentPayment(contract._id as Types.ObjectId, period, amount);
    if (!existing) return res.status(500).json({ error: 'rent_payment_unavailable' });
    const attempt = await claimRentPayment(existing);
    if (attempt.kind === 'paid') {
      return res.status(400).json({ error: 'ya_pagado' });
    }
    if (attempt.kind === 'in_progress') {
      return res.json({ status: 'PROCESSING', clientSecret: attempt.clientSecret, amount });
    }
    const rentPayment = attempt.rentPayment;

    const monthName = now.toLocaleString('es-ES', { month: 'long' });
    const concept = `Renta ${monthName} ${now.getFullYear()}`;
    const amountCents = Math.round(amount * 100);

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
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
    } catch (err) {
      await releaseRentClaim(rentPayment._id as Types.ObjectId, attempt.previousStatus);
      throw err;
    }
    await attachRentIntent(rentPayment._id as Types.ObjectId, paymentIntent.id, userId);

    // Un único Payment por mes: si hubo un intento fallido antes, se reutiliza.
    await Payment.findOneAndUpdate(
      {
        contract: contract._id,
        type: 'rent',
        billingMonth: now.getMonth() + 1,
        billingYear: now.getFullYear(),
        status: { $ne: 'succeeded' },
      },
      {
        $set: {
          payer: userId,
          payee: contract.landlord,
          amount,
          currency: 'eur',
          stripePaymentIntentId: paymentIntent.id,
          status: 'pending',
          concept,
        },
      },
      { upsert: true },
    );

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
    if (!contract.stripeCustomerId) {
      return res.status(400).json({ error: 'Configuración de pago incompleta en el contrato.' });
    }
    const existing = await ensureRentPayment(contract._id as Types.ObjectId, period, contract.rent);
    if (!existing) {
      return res.status(500).json({ error: 'rent_payment_unavailable' });
    }
    const attempt = await claimRentPayment(existing);
    if (attempt.kind === 'paid') {
      return res.status(400).json({ error: 'ya_pagado' });
    }
    if (attempt.kind === 'in_progress') {
      return res.json({ status: 'PROCESSING', clientSecret: attempt.clientSecret, amount: attempt.rentPayment.amount });
    }
    const rentPayment = attempt.rentPayment;
    let intent;
    try {
      intent = await createPaymentIntent(contract.stripeCustomerId, contract.rent, contract.currency || 'eur', {
        metadata: {
          rentPaymentId: String(rentPayment._id),
          contractId: String(contract._id),
          period,
        },
      });
    } catch (err) {
      await releaseRentClaim(rentPayment._id as Types.ObjectId, attempt.previousStatus);
      throw err;
    }
    await attachRentIntent(rentPayment._id as Types.ObjectId, intent.id, userId);
    await recordFunnelEvent(req, 'payment', {
      resourceType: 'rentPayment',
      resourceId: String(rentPayment._id),
      meta: { contractId: String(contract._id), amount: contract.rent, period, phase: 'rent_period' },
    });
    res.json({ clientSecret: intent.client_secret, amount: contract.rent, status: 'PROCESSING' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'rent_payment_failed' });
  }
};
