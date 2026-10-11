import { Schema } from 'mongoose';

/**
 * Disputa (contracargo) de Stripe sobre un cobro. Se guarda junto al pago, el recibo de renta
 * o la fianza del contrato; el estado del cobro no cambia: decidir qué pasa si se pierde
 * (deuda del inquilino, nuevo cobro) queda fuera del webhook.
 */
export interface PaymentDispute {
  id: string;
  /** Estado de Stripe: warning_needs_response, needs_response, under_review, won, lost… */
  status: string;
  reason?: string;
  /** Euros disputados. */
  amount?: number;
  openedAt?: Date;
  closedAt?: Date;
}

/** Estados finales: un evento tardío (`updated`) no los reabre. */
export const CLOSED_DISPUTE_STATUSES = ['won', 'lost', 'warning_closed'];

export const paymentDisputeSchema = new Schema<PaymentDispute>(
  {
    id: { type: String, required: true },
    status: { type: String, required: true },
    reason: { type: String },
    amount: { type: Number },
    openedAt: { type: Date },
    closedAt: { type: Date },
  },
  { _id: false },
);
