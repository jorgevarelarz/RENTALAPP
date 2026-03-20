export type PropertyStatus = 'draft' | 'active' | 'rented' | 'inactive';

export interface PropertyLocation {
  type?: 'Point';
  coordinates?: [number, number];
}

export interface PropertyTenantPro {
  status: string;
}

export interface PropertyTenant {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  tenantPro?: PropertyTenantPro;
}

export interface PropertyApplication {
  _id: string;
  tenant: PropertyTenant;
  status: 'pending' | 'proposed' | 'scheduled' | 'rejected';
  proposedBy?: 'tenant' | 'landlord';
  proposedDate?: string;
  visitDate?: string;
  createdAt: string;
  message?: string;
}

export interface Property {
  _id: string;
  title: string;
  address: string;
  city?: string;
  region?: string;
  description?: string;
  price?: number;
  deposit?: number;
  rooms?: number;
  bathrooms?: number;
  sizeM2?: number;
  images?: string[];
  photos?: string[];
  furnished?: boolean;
  petsAllowed?: boolean;
  availableFrom?: string;
  onlyTenantPro?: boolean;
  requiredTenantProMaxRent?: number;
  status?: PropertyStatus;
  location?: PropertyLocation;
  owner?: string;
  ownerId?: string;
  _liked?: boolean;
}

export interface PropertyListResponse {
  items: Property[];
  page: number;
  limit: number;
  total: number;
}

export interface PropertyFavoritesResponse {
  items: Property[];
}
