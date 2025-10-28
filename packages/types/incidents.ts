export type IncidentStatus =
  | 'OPEN'
  | 'QUOTE'
  | 'ESCROW'
  | 'IN_PROGRESS'
  | 'EXTRA_REQUESTED'
  | 'DONE'
  | 'DISPUTE'
  | 'CLOSED'
  | 'quoted'
  | 'awaiting_schedule'
  | 'awaiting_validation'
  | 'closed';

export interface Incident {
  id: string;
  propertyId?: string;
  title?: string;
  status: IncidentStatus;
  service?: string;
  createdAt: string;
  updatedAt?: string;
  ownerId?: string;
  openedBy?: string;
  proId?: string | null;
}

export interface IncidentList {
  items: Incident[];
  total: number;
  page: number;
  limit: number;
}
