import { ComplianceStatus } from '../models/complianceStatus.model';

type DashboardData = {
  totals: { evaluated: number; risk: number };
  byArea: { areaKey: string; total: number; risk: number }[];
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
};

export type ComplianceDashboardFilters = {
  page?: number | string;
  pageSize?: number | string;
};

function isDemoMode() {
  return String(process.env.RENTAL_PUBLIC_DEMO_MODE || '').toLowerCase() === 'true';
}

function getDemoDashboardData(): DashboardData {
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

  return {
    totals: { evaluated: 8, risk: 3 },
    byArea,
    items,
    page: 1,
    pageSize: 25,
  };
}

export async function getComplianceDashboard(filters: ComplianceDashboardFilters = {}): Promise<DashboardData> {
  if (isDemoMode()) {
    return getDemoDashboardData();
  }
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 25)));

  const [total, risk, byArea, rows] = await Promise.all([
    ComplianceStatus.countDocuments({}),
    ComplianceStatus.countDocuments({ status: 'risk' }),
    ComplianceStatus.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$meta.areaKey', 'unknown'] },
          total: { $sum: 1 },
          risk: { $sum: { $cond: [{ $eq: ['$status', 'risk'] }, 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 100 },
      { $project: { _id: 0, areaKey: '$_id', total: 1, risk: 1 } },
    ]),
    ComplianceStatus.find({})
      .sort({ checkedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate('property', 'address city region')
      .populate('contract', '_id')
      .lean(),
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
    items,
    page,
    pageSize,
  };
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
