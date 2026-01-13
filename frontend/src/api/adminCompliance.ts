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
  byArea: { areaKey: string; total: number; risk: number }[];
  items: ComplianceDashboardItem[];
  page: number;
  pageSize: number;
};

export type TensionedArea = {
  _id: string;
  areaKey: string;
  region: string;
  city?: string;
  zoneCode?: string;
  source: string;
  effectiveFrom: string;
  effectiveTo?: string;
  active: boolean;
};

export async function fetchComplianceDashboard(params?: { page?: number; pageSize?: number }) {
  const res = await api.get('/api/admin/compliance/dashboard', { params });
  return res.data?.data as ComplianceDashboardData;
}

export async function exportComplianceDashboardCsv(params?: { page?: number; pageSize?: number }) {
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
