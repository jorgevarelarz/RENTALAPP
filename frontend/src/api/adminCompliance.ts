import api from './client';

export type ComplianceDashboardItem = {
  contractId: string;
  propertyId: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyRegion?: string;
  previousRent: number;
  newRent: number;
  status: string;
  severity: string;
  checkedAt: string | Date;
  areaKey?: string;
};

export type ComplianceDashboardData = {
  totals: { evaluated: number; risk: number };
  lastUpdated?: string | Date | null;
  byArea: { areaKey: string; total: number; risk: number }[];
  items: ComplianceDashboardItem[];
  page: number;
  pageSize: number;
  total?: number;
};

export type TensionedArea = {
  _id: string;
  areaKey: string;
  region: string;
  city?: string;
  zoneCode?: string;
  source: string;
  maxRent?: number;
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  effectiveFrom: string;
  effectiveTo?: string;
  active: boolean;
};

export async function fetchComplianceDashboard(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  areaKey?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const res = await api.get('/api/admin/compliance/dashboard', { params });
  return res.data?.data as ComplianceDashboardData;
}

export async function exportComplianceDashboardCsv(params?: {
  status?: string;
  areaKey?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const res = await api.get('/api/admin/compliance/dashboard/export.csv', {
    params,
    responseType: 'blob',
  });
  return res.data as Blob;
}

export async function fetchTensionedAreas(params?: { region?: string; city?: string; active?: string }) {
  const res = await api.get('/api/admin/compliance/tensioned-areas', { params });
  return (res.data?.data || []) as TensionedArea[];
}

export async function upsertTensionedArea(payload: {
  region: string;
  city?: string;
  zoneCode?: string;
  areaKey?: string;
  source: string;
  maxRent?: number;
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  effectiveFrom: string;
  effectiveTo?: string;
  active?: boolean;
}) {
  const res = await api.post('/api/admin/compliance/tensioned-areas', payload);
  return res.data?.data as TensionedArea;
}
