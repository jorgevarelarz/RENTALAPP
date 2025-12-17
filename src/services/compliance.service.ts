import { Contract } from '../models/contract.model';

export type AuditTrailStatus = 'created' | 'sent' | 'completed' | 'declined' | 'error' | 'none' | string;

export type AuditSummaryFilters = {
  userId?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  status?: AuditTrailStatus;
  page?: number | string;
  pageSize?: number | string;
};

export type AuditSummaryItem = {
  contractId: string;
  user: { name?: string; email?: string } | null;
  status: AuditTrailStatus;
  lastEvent?: Date;
  auditHash?: string | null;
  auditPdfUrl?: string;
};

export type AuditStatusStats = {
  completed: number;
  sent: number;
  declined: number;
  error: number;
  created: number;
  other: number;
};

const toDate = (v?: string | Date) => {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

function buildContractQuery(filters: AuditSummaryFilters, opts?: { includeStatusFilter?: boolean }) {
  const query: any = {};

  if (filters.userId) query.$or = [{ landlord: filters.userId }, { tenant: filters.userId }];

  const from = toDate(filters.dateFrom);
  const to = toDate(filters.dateTo);
  if (from || to) {
    query.updatedAt = {
      ...(from && { $gte: from }),
      ...(to && { $lte: to }),
    };
  }

  if (opts?.includeStatusFilter !== false && filters.status) query['signature.status'] = filters.status;

  return query;
}

export async function getAuditStatusStats(filters: AuditSummaryFilters): Promise<AuditStatusStats> {
  const query = buildContractQuery(filters, { includeStatusFilter: false });
  query['signature.status'] = { $nin: [null, 'none'] };

  const rows = await Contract.aggregate([
    { $match: query },
    { $group: { _id: '$signature.status', count: { $sum: 1 } } },
  ]);

  const stats: AuditStatusStats = { completed: 0, sent: 0, declined: 0, error: 0, created: 0, other: 0 };
  for (const r of rows as any[]) {
    const key = String(r._id || 'other');
    if (key in stats) (stats as any)[key] = r.count;
    else stats.other += r.count;
  }
  return stats;
}

export async function getAuditSummary(filters: AuditSummaryFilters) {
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 25)));

  const query = buildContractQuery(filters, { includeStatusFilter: true });
  query['signature.status'] = query['signature.status'] ?? { $nin: [null, 'none'] };

  const [total, contracts] = await Promise.all([
    Contract.countDocuments(query),
    Contract.find(query)
      .populate('landlord', 'name email')
      .populate('tenant', 'name email')
      .select('_id landlord tenant signature.status updatedAt signature.auditPdfHash signature.auditPdfUrl')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  const items: AuditSummaryItem[] = (contracts as any[]).map(c => ({
    contractId: String(c._id),
    user:
      c.landlord || c.tenant
        ? { name: c.landlord?.name || c.tenant?.name, email: c.landlord?.email || c.tenant?.email }
        : null,
    status: c.signature?.status || 'none',
    lastEvent: c.updatedAt,
    auditHash: c.signature?.auditPdfHash || null,
    auditPdfUrl: c.signature?.auditPdfUrl,
  }));

  return { items, total, page, pageSize };
}

export async function getPendingContracts() {
  return Contract.find({ 'signature.status': { $ne: 'completed' } })
    .select('_id updatedAt signature.status')
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
}
