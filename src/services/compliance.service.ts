import { Contract } from '../models/contract.model';
import { User } from '../models/user.model';

type AuditSummaryFilters = {
  userId?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  status?: string;
};

const toDate = (v?: string | Date) => {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export async function getAuditSummary({ userId, dateFrom, dateTo, status }: AuditSummaryFilters) {
  const query: any = {};

  if (status) query['signature.status'] = status;

  const from = toDate(dateFrom);
  const to = toDate(dateTo);
  if (from || to) {
    query.updatedAt = {
      ...(from && { $gte: from }),
      ...(to && { $lte: to }),
    };
  }

  if (userId) query.$or = [{ landlord: userId }, { tenant: userId }];

  const contracts = await Contract.find(query)
    .populate('landlord', 'name email')
    .populate('tenant', 'name email')
    .select('_id landlord tenant signature.status updatedAt signature.auditPdfHash signature.auditPdfUrl')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  return contracts.map((c: any) => ({
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
}

export async function getPendingContracts() {
  return Contract.find({ 'signature.status': { $ne: 'completed' } })
    .select('_id updatedAt signature.status')
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
}
