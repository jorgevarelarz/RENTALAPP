import { Types } from 'mongoose';
import { RentPayment, IRentPayment, RentPaymentStatus } from '../models/rentPayment.model';
import { stripe } from '../utils/stripe';

/**
 * Intentos de cobro de un recibo de renta (RentPayment) sin cobros duplicados.
 *
 * Antes de crear el PaymentIntent, la petición "reclama" el recibo con un paso
 * atómico DUE/FAILED → PROCESSING. Si dos peticiones llegan a la vez, solo una
 * lo consigue; la otra reanuda el intento abierto en lugar de crear otro.
 */

// Un reclamo sin PaymentIntent asociado tras este tiempo se considera abandonado
// (la petición que lo hizo se cayó antes de guardar el intento).
export const STALE_CLAIM_MS = 5 * 60 * 1000;

// Estados de Stripe en los que el inquilino aún puede completar el pago con el mismo intento.
export const RESUMABLE_INTENT_STATUSES = new Set(['requires_payment_method', 'requires_confirmation', 'requires_action']);

export type RentAttemptOutcome =
  | { kind: 'paid' }
  | { kind: 'claimed'; rentPayment: IRentPayment; previousStatus: RentPaymentStatus }
  | { kind: 'in_progress'; rentPayment: IRentPayment; clientSecret?: string };

/** Crea el recibo del periodo si no existe (seguro ante peticiones simultáneas). */
export async function ensureRentPayment(contractId: Types.ObjectId, period: string, amount: number) {
  try {
    return await RentPayment.findOneAndUpdate(
      { contractId, period },
      { $setOnInsert: { contractId, period, amount, status: 'DUE' } },
      { upsert: true, new: true },
    );
  } catch (err: any) {
    if (err?.code === 11000) return RentPayment.findOne({ contractId, period });
    throw err;
  }
}

async function resumableClientSecret(providerPaymentId?: string): Promise<{ secret?: string; canceled?: boolean }> {
  if (!providerPaymentId) return {};
  try {
    const intent = await stripe.paymentIntents.retrieve(providerPaymentId);
    if (intent.status === 'canceled') return { canceled: true };
    if (RESUMABLE_INTENT_STATUSES.has(intent.status)) return { secret: intent.client_secret || undefined };
  } catch (err) {
    console.error('[rentPayment] no se pudo recuperar el PaymentIntent', providerPaymentId, err);
  }
  return {};
}

/**
 * Reclama el recibo para un nuevo intento de cobro o devuelve el intento en curso.
 */
export async function claimRentPayment(rentPayment: IRentPayment): Promise<RentAttemptOutcome> {
  if (rentPayment.status === 'PAID') return { kind: 'paid' };

  if (rentPayment.status === 'PROCESSING' && rentPayment.providerPaymentId) {
    const resume = await resumableClientSecret(rentPayment.providerPaymentId);
    if (!resume.canceled) return { kind: 'in_progress', rentPayment, clientSecret: resume.secret };
  }

  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);
  const previous = await RentPayment.findOneAndUpdate(
    {
      _id: rentPayment._id,
      $or: [
        { status: { $in: ['DUE', 'FAILED'] } },
        // El intento anterior fue cancelado en Stripe.
        ...(rentPayment.status === 'PROCESSING' && rentPayment.providerPaymentId
          ? [{ status: 'PROCESSING', providerPaymentId: rentPayment.providerPaymentId }]
          : []),
        { status: 'PROCESSING', providerPaymentId: null, updatedAt: { $lt: staleBefore } },
      ],
    },
    { $set: { status: 'PROCESSING' }, $unset: { providerPaymentId: 1 } },
    { new: false },
  );

  if (previous) {
    const claimed = await RentPayment.findById(previous._id);
    return { kind: 'claimed', rentPayment: claimed!, previousStatus: previous.status };
  }

  // Otra petición se adelantó: devolvemos su estado.
  const current = await RentPayment.findById(rentPayment._id);
  if (!current || current.status === 'PAID') return { kind: 'paid' };
  const resume = await resumableClientSecret(current.providerPaymentId);
  return { kind: 'in_progress', rentPayment: current, clientSecret: resume.secret };
}

/** Asocia el PaymentIntent creado al recibo reclamado. */
export async function attachRentIntent(rentPaymentId: Types.ObjectId, intentId: string, userId?: string) {
  return RentPayment.findOneAndUpdate(
    { _id: rentPaymentId, status: 'PROCESSING' },
    {
      $set: {
        providerPaymentId: intentId,
        ...(userId && Types.ObjectId.isValid(userId) ? { paidByUserId: new Types.ObjectId(userId) } : {}),
      },
    },
    { new: true },
  );
}

/** Deshace el reclamo si no se llegó a crear el PaymentIntent. */
export async function releaseRentClaim(rentPaymentId: Types.ObjectId, previousStatus: RentPaymentStatus) {
  const status = previousStatus === 'FAILED' ? 'FAILED' : 'DUE';
  await RentPayment.updateOne(
    { _id: rentPaymentId, status: 'PROCESSING', providerPaymentId: null },
    { $set: { status } },
  );
}
