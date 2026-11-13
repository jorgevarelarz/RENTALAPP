import { isValidObjectId } from 'mongoose';
import { PolicyVersion } from '../models/policy.model';
import { User } from '../models/user.model';
import { UserPolicyAcceptance } from '../models/userPolicyAcceptance.model';
import { csvRows } from '../utils/csv';

export const POLICY_TYPES = ['privacy_policy', 'terms_of_service', 'cookies_policy', 'data_processing'] as const;

export type PolicyAcceptanceFilters = {
  userId?: unknown;
  policyType?: unknown;
  activeOnly?: unknown;
  page?: unknown;
  pageSize?: unknown;
};

export class PolicyAcceptanceFilterError extends Error {}

// `?page=abc` no puede llegar a Mongo como NaN
function positiveInt(value: unknown, fallback: number) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

// Devuelve null si el filtro no puede dar resultados (activeOnly sin versiones vigentes).
// userId y policyType llegan de la query sin validar: un id mal formado daba 500 (CastError)
// y una política inexistente, lista vacía. Las claves con `$` ya las corta rejectMongoOperators.
async function buildAcceptancesQuery(filters: PolicyAcceptanceFilters) {
  const query: Record<string, unknown> = {};
  if (filters.userId !== undefined && filters.userId !== '') {
    if (typeof filters.userId !== 'string' || !isValidObjectId(filters.userId)) {
      throw new PolicyAcceptanceFilterError('invalid_user_id');
    }
    query.userId = filters.userId;
  }
  if (filters.policyType !== undefined && filters.policyType !== '') {
    if (typeof filters.policyType !== 'string' || !(POLICY_TYPES as readonly string[]).includes(filters.policyType)) {
      throw new PolicyAcceptanceFilterError('invalid_policy_type');
    }
    query.policyType = filters.policyType;
  }
  if (filters.activeOnly === 'true' || filters.activeOnly === true) {
    const now = new Date();
    const active = await PolicyVersion.find({
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .select(['policyType', 'version'])
      .lean();
    // Antes se filtraba en memoria tras traerlas todas; en la consulta permite paginar
    if (active.length === 0) return null;
    query.$or = active.map(p => ({ policyType: p.policyType, policyVersion: p.version }));
  }
  return query;
}

async function withEmails(acceptances: any[]) {
  const users = await User.find({ _id: { $in: acceptances.map(a => a.userId) } })
    .select(['email'])
    .lean();
  const emails = new Map(users.map(u => [String(u._id), (u as any).email as string]));
  return acceptances.map(a => ({
    user: { id: String(a.userId), email: emails.get(String(a.userId)) ?? '' },
    policyType: a.policyType,
    policyVersion: a.policyVersion,
    acceptedAt: a.acceptedAt,
    ip: a.ip,
    userAgent: a.userAgent,
  }));
}

export async function listPolicyAcceptances(filters: PolicyAcceptanceFilters) {
  const page = positiveInt(filters.page, 1);
  const pageSize = Math.min(100, positiveInt(filters.pageSize, 25));
  const query = await buildAcceptancesQuery(filters);
  if (!query) return { data: [], total: 0, page, pageSize };

  const [total, items] = await Promise.all([
    UserPolicyAcceptance.countDocuments(query),
    UserPolicyAcceptance.find(query)
      .sort({ acceptedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);
  return { data: await withEmails(items), total, page, pageSize };
}

export async function buildPolicyAcceptancesCsv(filters: PolicyAcceptanceFilters) {
  const query = await buildAcceptancesQuery(filters);
  const items = query ? await UserPolicyAcceptance.find(query).sort({ acceptedAt: -1, _id: -1 }).lean() : [];
  const rows = (await withEmails(items)).map(a => [
    a.user.id,
    a.user.email,
    a.policyType,
    a.policyVersion,
    a.acceptedAt ? new Date(a.acceptedAt).toISOString() : '',
    a.ip || '',
    a.userAgent || '',
  ]);
  const header = ['userId', 'email', 'policyType', 'policyVersion', 'acceptedAt', 'ip', 'userAgent'];
  return csvRows([header, ...rows]);
}
