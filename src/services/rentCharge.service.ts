import type Stripe from 'stripe';
import { stripe } from '../utils/stripe';
import { User } from '../models/user.model';
import { Contract } from '../models/contract.model';
import { calcPlatformFeeOnRent, calcSignFeeOnRent } from '../utils/rentFees';

/**
 * Reparto de un cobro de renta. El dinero de la renta es del propietario: cada PaymentIntent de
 * renta es un cargo con destino a su cuenta de Stripe Connect y la plataforma retiene su comisión
 * (`application_fee_amount`). Sin cuenta conectada no se cobra: la renta se quedaría en la cuenta
 * de la plataforma sin forma de entregarla.
 */

export type RentChargeErrorCode = 'owner_not_connected' | 'owner_payouts_disabled';

export class RentChargeError extends Error {
  status = 409;
  constructor(public code: RentChargeErrorCode) {
    super(code);
  }
}

export const RENT_CHARGE_MESSAGES: Record<RentChargeErrorCode, string> = {
  owner_not_connected:
    'El propietario todavía no ha activado los cobros en RentalApp. Podrás pagar en cuanto lo haga.',
  owner_payouts_disabled:
    'La cuenta de cobros del propietario está pendiente de verificación. Podrás pagar en cuanto la complete.',
};

export function isRentChargeError(err: unknown): err is RentChargeError {
  return err instanceof RentChargeError;
}

type RentContract = {
  _id: unknown;
  landlord: unknown;
  signFeeCollected?: boolean;
};

export type RentChargeSplit = {
  /** Parámetros del PaymentIntent: destino y comisión retenida. */
  params: Pick<Stripe.PaymentIntentCreateParams, 'transfer_data' | 'application_fee_amount'>;
  /** Metadatos que lee el webhook (reparto a la agencia, comisión de firma). */
  metadata: Record<string, string>;
  rentFeeCents: number;
  signFeeCents: number;
};

export async function rentChargeSplit(contract: RentContract, amountCents: number): Promise<RentChargeSplit> {
  const owner = await User.findById(contract.landlord).select('stripeAccountId').lean();
  const destination = owner?.stripeAccountId;
  if (!destination) throw new RentChargeError('owner_not_connected');

  // Un cargo con destino exige que la cuenta pueda recibir transferencias.
  const account = await stripe.accounts.retrieve(destination);
  if (account.capabilities?.transfers !== 'active') throw new RentChargeError('owner_payouts_disabled');

  const rentFeeCents = calcPlatformFeeOnRent(amountCents);
  // La comisión de firma se cobra una vez, con la primera renta que se paga.
  const signFeeCents = contract.signFeeCollected ? 0 : calcSignFeeOnRent(amountCents);
  const applicationFeeCents = Math.min(rentFeeCents + signFeeCents, amountCents);

  return {
    params: {
      transfer_data: { destination },
      ...(applicationFeeCents > 0 ? { application_fee_amount: applicationFeeCents } : {}),
    },
    metadata: {
      kind: 'rent',
      ownerId: String(contract.landlord),
      rentCents: String(amountCents),
      rentFeeCents: String(rentFeeCents),
      signFeeCents: String(signFeeCents),
    },
    rentFeeCents,
    signFeeCents,
  };
}

/** La comisión de firma queda cobrada cuando Stripe confirma el pago que la llevaba. */
export async function markSignFeeCollected(contractId: string, metadata?: Stripe.Metadata | null) {
  const signFeeCents = Number(metadata?.signFeeCents);
  if (!Number.isFinite(signFeeCents) || signFeeCents <= 0) return;
  await Contract.updateOne(
    { _id: contractId, signFeeCollected: { $ne: true } },
    { $set: { signFeeCollected: true, signFeeCollectedAt: new Date() } },
  );
}
