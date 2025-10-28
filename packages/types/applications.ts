export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'visited';

export interface ApplicationProperty {
  _id?: string;
  title?: string;
  city?: string;
  price?: number;
  owner?: string;
  onlyTenantPro?: boolean;
}

export interface ApplicationTenant {
  id: string;
  email?: string;
  name?: string;
  tenantProStatus?: string;
  tenantProMaxRent?: number;
}

export interface Application {
  id: string;
  propertyId: string;
  status: ApplicationStatus;
  visitDate?: string;
  createdAt: string;
  property?: ApplicationProperty | null;
  tenant?: ApplicationTenant | null;
}

export interface ApplicationList {
  items: Application[];
  total: number;
  page: number;
  limit: number;
}
