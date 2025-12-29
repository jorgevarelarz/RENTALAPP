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

export interface Contract {
  _id?: string;
  id?: string;
  status: ContractStatus;
  rent: number;
  deposit: number;
  depositPaid?: boolean;
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
}
