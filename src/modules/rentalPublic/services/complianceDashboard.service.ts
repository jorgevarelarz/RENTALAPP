import { ComplianceStatus } from '../models/complianceStatus.model';

export type ComplianceDashboardFilters = {
  page?: number | string;
  pageSize?: number | string;
};

export async function getComplianceDashboard(filters: ComplianceDashboardFilters = {}) {
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
