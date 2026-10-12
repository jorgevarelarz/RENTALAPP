export type PropertyStatus = 'draft' | 'active' | 'archived' | 'rented' | 'inactive';

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
  floor?: number;
  hasElevator?: boolean;
  condition?: 'obra_nueva' | 'reformado' | 'buen_estado' | 'a_reformar';
  yearBuilt?: number;
  viewsCount?: number;
  owner?: string;
  ownerId?: string;
  _liked?: boolean;
  /** Solo en la ficha: quien la ve es el propietario, su agencia o un administrador. */
  _mine?: boolean;
  /** Solo en la ficha y para el inquilino que ya la ha solicitado. */
  _application?: PropertyViewerApplication;
}

export interface PropertyViewerApplication {
  status: PropertyApplication['status'];
  createdAt?: string;
  visitDate?: string;
  proposedDate?: string;
  proposedBy?: 'tenant' | 'landlord';
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
