import { ComplianceStatus } from '../models/complianceStatus.model';
import { PipelineStage } from 'mongoose';
import { parseDateRange } from '../../../utils/dateRange';

type DashboardData = {
  totals: { evaluated: number; risk: number };
  lastUpdated?: Date | null;
  byArea: { areaKey: string; total: number; risk: number }[];
  byAreaTotal?: number;
  items: {
    contractId: string;
    propertyId: string;
    propertyAddress?: string;
    propertyCity?: string;
    propertyRegion?: string;
    previousRent: number;
    newRent: number;
    status: string;
    severity: string;
    checkedAt: Date;
    areaKey?: string;
  }[];
  page: number;
  pageSize: number;
  total: number;
};

export type ComplianceDashboardFilters = {
  page?: number | string;
  pageSize?: number | string;
  byAreaPage?: number | string;
  byAreaPageSize?: number | string;
  status?: string;
  areaKey?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  includeAll?: boolean;
};

function isDemoMode() {
  return String(process.env.RENTAL_PUBLIC_DEMO_MODE || '').toLowerCase() === 'true';
}

function getDemoDashboardData(filters: ComplianceDashboardFilters = {}): DashboardData {
  const checkedAt = new Date('2025-02-01T10:00:00.000Z');
  const items = [
    {
      contractId: 'demo-ctr-001',
      propertyId: 'demo-prop-001',
      propertyAddress: 'Avenida del Faro 12',
      propertyCity: 'Oleiros',
      propertyRegion: 'galicia',
      previousRent: 900,
      newRent: 1000,
      status: 'risk',
      severity: 'warning',
      checkedAt,
      areaKey: 'galicia|oleiros|',
    },
    {
      contractId: 'demo-ctr-002',
      propertyId: 'demo-prop-002',
      propertyAddress: 'Calle Mayor 44',
      propertyCity: 'Madrid',
      propertyRegion: 'madrid',
      previousRent: 1200,
      newRent: 1350,
      status: 'risk',
      severity: 'warning',
      checkedAt,
      areaKey: 'madrid|madrid|centro',
    },
    {
      contractId: 'demo-ctr-003',
      propertyId: 'demo-prop-003',
      propertyAddress: 'Rua Nova 3',
      propertyCity: 'Santiago',
      propertyRegion: 'galicia',
      previousRent: 700,
      newRent: 700,
      status: 'compliant',
      severity: 'info',
      checkedAt,
      areaKey: 'galicia|santiago|',
    },
    {
      contractId: 'demo-ctr-004',
      propertyId: 'demo-prop-004',
      propertyAddress: 'Carrer de la Mar 18',
      propertyCity: 'Valencia',
      propertyRegion: 'valencia',
      previousRent: 850,
      newRent: 820,
      status: 'compliant',
      severity: 'info',
      checkedAt,
      areaKey: 'valencia|valencia|',
    },
  ];

  const byArea = [
    { areaKey: 'galicia|oleiros|', total: 2, risk: 1 },
    { areaKey: 'madrid|madrid|centro', total: 1, risk: 1 },
    { areaKey: 'galicia|santiago|', total: 1, risk: 0 },
  ];

  const filtered = items.filter(item => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.areaKey && item.areaKey !== filters.areaKey) return false;
    if (filters.dateFrom && new Date(item.checkedAt).getTime() < new Date(filters.dateFrom).getTime()) return false;
    if (filters.dateTo && new Date(item.checkedAt).getTime() > new Date(filters.dateTo).getTime()) return false;
    return true;
  });

  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 25)));
  const byAreaPage = Math.max(1, Number(filters.byAreaPage || 1));
  const byAreaPageSize = Math.min(100, Math.max(1, Number(filters.byAreaPageSize || 100)));
  const total = filtered.length;
  const risk = filtered.filter(item => item.status === 'risk').length;
  const lastUpdated = filtered.length ? new Date(filtered[0].checkedAt) : null;
  const paged = filters.includeAll ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    totals: { evaluated: total, risk },
    byArea,
    byAreaTotal: byArea.length,
    items: paged,
    page,
    pageSize,
    lastUpdated,
    total,
  };
}

export async function getComplianceDashboard(filters: ComplianceDashboardFilters = {}): Promise<DashboardData> {
  if (isDemoMode()) {
    return getDemoDashboardData(filters);
  }
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 25)));
  const byAreaPage = Math.max(1, Number(filters.byAreaPage || 1));
  const byAreaPageSize = Math.min(100, Math.max(1, Number(filters.byAreaPageSize || 100)));

  const query: any = {};
  if (filters.status) query.status = filters.status;
  if (filters.areaKey) query['meta.areaKey'] = String(filters.areaKey).trim().toLowerCase();
  if (filters.dateFrom || filters.dateTo) {
    const parsed = parseDateRange({ dateFrom: filters.dateFrom, dateTo: filters.dateTo });
    if ('error' in parsed) {
      throw new Error('invalid_date_range');
    }
    query.checkedAt = {
      ...(parsed.from ? { $gte: parsed.from } : {}),
      ...(parsed.to ? { $lte: parsed.to } : {}),
    };
  }

  const byAreaMatch: PipelineStage[] = [
    { $match: query },
    {
      $group: {
        _id: { $ifNull: ['$meta.areaKey', 'unknown'] },
        total: { $sum: 1 },
        risk: { $sum: { $cond: [{ $eq: ['$status', 'risk'] }, 1, 0] } },
      },
    },
    { $sort: { total: -1 as const } },
  ];

  const [total, risk, byArea, byAreaTotalRow, rows, lastUpdatedRow] = await Promise.all([
    ComplianceStatus.countDocuments(query),
    ComplianceStatus.countDocuments({ ...query, status: 'risk' }),
    ComplianceStatus.aggregate([
      ...byAreaMatch,
      { $skip: (byAreaPage - 1) * byAreaPageSize },
      { $limit: byAreaPageSize },
      { $project: { _id: 0, areaKey: '$_id', total: 1, risk: 1 } },
    ]),
    ComplianceStatus.aggregate([...byAreaMatch, { $count: 'total' }]),
    ComplianceStatus.find(query)
      .sort({ checkedAt: -1 })
      .skip(filters.includeAll ? 0 : (page - 1) * pageSize)
      .limit(filters.includeAll ? 0 : pageSize)
      .populate('property', 'address city region')
      .populate('contract', '_id')
      .lean(),
    ComplianceStatus.find(query).sort({ checkedAt: -1 }).select('checkedAt').limit(1).lean(),
  ]);

  const items = (rows as any[]).map(r => ({
    contractId: String(r.contract?._id ?? r.contract ?? ''),
    propertyId: String(r.property?._id ?? r.property ?? ''),
    propertyAddress: r.property?.address,
    propertyCity: r.property?.city,
    propertyRegion: r.property?.region,
    previousRent: r.previousRent,
    newRent: r.newRent,
    status: r.status,
    severity: r.severity,
    checkedAt: r.checkedAt,
    areaKey: r.meta?.areaKey,
  }));

  return {
    totals: { evaluated: total, risk },
    byArea,
    byAreaTotal: byAreaTotalRow?.[0]?.total || 0,
    items,
    page,
    pageSize,
    lastUpdated: lastUpdatedRow?.[0]?.checkedAt || null,
    total,
  };
}

export function buildComplianceQuery(filters: ComplianceDashboardFilters = {}) {
  const query: any = {};
  if (filters.status) query.status = filters.status;
  if (filters.areaKey) query['meta.areaKey'] = String(filters.areaKey).trim().toLowerCase();
  if (filters.dateFrom || filters.dateTo) {
    const parsed = parseDateRange({ dateFrom: filters.dateFrom, dateTo: filters.dateTo });
    if ('error' in parsed) {
      throw new Error('invalid_date_range');
    }
    query.checkedAt = {
      ...(parsed.from ? { $gte: parsed.from } : {}),
      ...(parsed.to ? { $lte: parsed.to } : {}),
    };
  }
  return query;
}

export function buildComplianceCsv(data: DashboardData) {
  const header = ['property_id', 'areaKey', 'previousRent', 'newRent', 'status', 'checkedAt'];
  const rows = data.items.map(i => [
    i.propertyId,
    i.areaKey || '',
    String(i.previousRent ?? ''),
    String(i.newRent ?? ''),
    String(i.status ?? ''),
    i.checkedAt ? new Date(i.checkedAt).toISOString() : '',
  ]);

  return [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}
