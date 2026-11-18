export type ContractStatus =
  | 'draft'
  | 'generated'
  | 'pending_signature'
  | 'signing'
  | 'signed'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'terminated';

export type ContractProperty = {
  _id: string;
  title?: string;
  address?: string;
  city?: string;
  images?: string[];
};

export type ContractParty = {
  _id: string;
  name?: string;
  email?: string;
};

/** Disputa (contracargo) de Stripe sobre un cobro; `status` es el de Stripe. */
export type PaymentDispute = {
  id: string;
  status: string;
  reason?: string;
  amount?: number;
  openedAt?: string;
  closedAt?: string;
};

export interface Contract {
  _id?: string;
  id?: string;
  status: ContractStatus;
  rent: number;
  deposit: number;
  depositPaid?: boolean;
  /** Euros de la fianza devueltos en Stripe (también parciales). */
  depositAmountRefunded?: number;
  /** Solo si la devolución fue total. */
  depositRefundedAt?: string;
  depositDispute?: PaymentDispute;
  /** Recibos de renta con disputa (solo en el detalle). */
  rentDisputes?: Array<PaymentDispute & { period: string }>;
  signedAt?: string;
  startDate?: string;
  endDate?: string;
  property?: ContractProperty | string;
  landlord?: ContractParty | string;
  tenant?: ContractParty | string;
  landlordName?: string;
  landlordEmail?: string;
  tenantName?: string;
  tenantEmail?: string;
  propertyAddress?: string;
  address?: string;
  ownerId?: string;
  tenantId?: string;
  /** Papel del usuario en el contrato (solo en la lista de contratos). */
  myRole?: 'landlord' | 'tenant' | 'cotenant';
}
