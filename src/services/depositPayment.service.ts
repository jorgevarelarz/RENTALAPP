import { Contract } from '../models/contract.model';
import { Payment } from '../models/payment.model';

type ContractDoc = InstanceType<typeof Contract>;

interface DepositPaymentInput {
  intentId: string;
  amount: number;
  paidAt: Date;
  currency?: string;
  amountRefunded?: number;
  refundedAt?: Date;
}

/**
 * Guarda la fianza cobrada por Checkout como `Payment` (tipo `deposit`), para que tenga recibo y
 * salga en los cobros del contrato. Idempotente por PaymentIntent: los reenvíos no la duplican.
 * Devuelve `true` si lo ha creado.
 */
export async function recordDepositPayment(contract: ContractDoc, input: DepositPaymentInput): Promise<boolean> {
  const refunded = !!input.refundedAt;
  try {
    const result = await Payment.updateOne(
      { stripePaymentIntentId: input.intentId },
      {
        $setOnInsert: {
          contract: contract._id,
          payer: contract.tenant,
          payee: contract.landlord,
          amount: input.amount,
          currency: input.currency || 'eur',
          status: refunded ? 'refunded' : 'succeeded',
          type: 'deposit',
          concept: 'Fianza',
          paidAt: input.paidAt,
          stripePaymentIntentId: input.intentId,
          ...(input.amountRefunded ? { amountRefunded: input.amountRefunded } : {}),
          ...(refunded ? { refundedAt: input.refundedAt } : {}),
        },
      },
      { upsert: true },
    );
    return result.upsertedCount > 0;
  } catch (err: any) {
    if (err?.code === 11000) return false; // otro reenvío simultáneo ya lo creó
    throw err;
  }
}

export interface DepositBackfillResult {
  /** Fianzas pagadas sin `Payment` que se han creado (o se crearían, en modo prueba). */
  created: string[];
  /** Fianzas pagadas sin PaymentIntent guardado: no se pueden enlazar sin consultar Stripe. */
  withoutIntent: string[];
}

/**
 * Crea el `Payment` de las fianzas cobradas antes de que el webhook lo guardara. Solo usa datos
 * del contrato (PaymentIntent, importe, fecha y devolución); sin `apply` no escribe nada.
 */
export async function backfillDepositPayments({ apply }: { apply: boolean }): Promise<DepositBackfillResult> {
  const result: DepositBackfillResult = { created: [], withoutIntent: [] };
  const contracts = await Contract.find({ depositPaid: true });
  for (const contract of contracts) {
    const intentId = contract.depositPaymentIntentId;
    if (!intentId) {
      result.withoutIntent.push(String(contract._id));
      continue;
    }
    if (await Payment.exists({ stripePaymentIntentId: intentId })) continue;
    const amount = Number(contract.deposit);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (apply) {
      const created = await recordDepositPayment(contract, {
        intentId,
        amount,
        paidAt: contract.depositPaidAt || (contract as any).updatedAt || new Date(),
        amountRefunded: contract.depositAmountRefunded,
        refundedAt: contract.depositRefundedAt,
      });
      if (!created) continue;
    }
    result.created.push(String(contract._id));
  }
  return result;
}
