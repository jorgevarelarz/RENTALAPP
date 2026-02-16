import { Request, Response } from 'express';
import crypto from 'crypto';
import { PipelineStage } from 'mongoose';
import { ComplianceStatus } from '../modules/rentalPublic/models/complianceStatus.model';
import { parseDateRange } from '../utils/dateRange';

const CASEID_SALT =
  process.env.INSTITUTION_CASEID_SALT || process.env.JWT_SECRET || 'insecure-institution-salt';

type InstitutionDashboardData = {
  totals: { evaluated: number; risk: number };
  lastUpdated?: Date | null;
  byArea: { areaKey: string; total: number; risk: number }[];
  byAreaTotal?: number;
  items: {
    caseId: string;
    areaKey?: string;
    previousRent: number;
    newRent: number;
    status: string;
    severity: string;
    checkedAt: Date;
  }[];
  page: number;
  pageSize: number;
  total: number;
};

type DashboardFilters = {
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

function hashCaseId(contractId: string) {
  return crypto
    .createHash('sha256')
    .update(`${contractId}:${CASEID_SALT}`)
    .digest('hex')
    .slice(0, 16);
}

function getScopeAreaKeys(req: Request) {
  return ((req as any).institutionScope?.areaKeys || []) as string[];
}

function buildQuery(filters: DashboardFilters, scopeAreaKeys: string[]) {
  const query: any = {
    'meta.areaKey': { $in: scopeAreaKeys },
  };

  if (filters.status) query.status = filters.status;
  if (filters.areaKey) {
    const normalized = String(filters.areaKey).trim().toLowerCase();
    if (!scopeAreaKeys.includes(normalized)) {
      return { error: 'area_not_in_scope' } as const;
    }
    query['meta.areaKey'] = normalized;
  }
  if (filters.dateFrom || filters.dateTo) {
    const parsed = parseDateRange({ dateFrom: filters.dateFrom, dateTo: filters.dateTo });
    if ('error' in parsed) {
      return { error: 'invalid_date_range' } as const;
    }
    query.checkedAt = {
      ...(parsed.from ? { $gte: parsed.from } : {}),
      ...(parsed.to ? { $lte: parsed.to } : {}),
    };
  }

  return { query } as const;
}

async function fetchInstitutionDashboard(
  filters: DashboardFilters,
  scopeAreaKeys: string[],
): Promise<InstitutionDashboardData> {
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 25)));
  const byAreaPage = Math.max(1, Number(filters.byAreaPage || 1));
  const byAreaPageSize = Math.min(100, Math.max(1, Number(filters.byAreaPageSize || 100)));

  const built = buildQuery(filters, scopeAreaKeys);
  if ('error' in built) {
    throw new Error(built.error);
  }
  const query = built.query;

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
      .select('contract previousRent newRent status severity checkedAt meta.areaKey')
      .lean(),
    ComplianceStatus.find(query).sort({ checkedAt: -1 }).select('checkedAt').limit(1).lean(),
  ]);

  const items = (rows as any[]).map(r => ({
    caseId: hashCaseId(String(r.contract)),
    areaKey: r.meta?.areaKey,
    previousRent: r.previousRent,
    newRent: r.newRent,
    status: r.status,
    severity: r.severity,
    checkedAt: r.checkedAt,
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

function buildInstitutionComplianceCsv(data: InstitutionDashboardData) {
  const header = ['case_id', 'areaKey', 'previousRent', 'newRent', 'status', 'checkedAt'];
  const rows = data.items.map(i => [
    i.caseId,
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

export const getInstitutionComplianceDashboard = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, byAreaPage, byAreaPageSize, status, areaKey, dateFrom, dateTo } = req.query as {
      page?: string;
      pageSize?: string;
      byAreaPage?: string;
      byAreaPageSize?: string;
      status?: string;
      areaKey?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    const scopeAreaKeys = getScopeAreaKeys(req);
    const data = await fetchInstitutionDashboard(
      { page, pageSize, byAreaPage, byAreaPageSize, status, areaKey, dateFrom, dateTo },
      scopeAreaKeys,
    );
    res.json({ data });
  } catch (error: any) {
    if (error?.message === 'area_not_in_scope') {
      return res.status(403).json({ error: 'area_not_in_scope' });
    }
    if (error?.message === 'invalid_date_range') {
      return res.status(400).json({ error: 'invalid_date_range' });
    }
    res.status(500).json({ error: error?.message || 'institution_dashboard_failed' });
  }
};

export const exportInstitutionComplianceDashboardCsv = async (req: Request, res: Response) => {
  try {
    const { status, areaKey, dateFrom, dateTo } = req.query as {
      status?: string;
      areaKey?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    const scopeAreaKeys = getScopeAreaKeys(req);
    const data = await fetchInstitutionDashboard(
      { status, areaKey, dateFrom, dateTo, includeAll: true },
      scopeAreaKeys,
    );
    const csv = buildInstitutionComplianceCsv(data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="institution-compliance.csv"');
    return res.send(csv);
  } catch (error: any) {
    if (error?.message === 'area_not_in_scope') {
      return res.status(403).json({ error: 'area_not_in_scope' });
    }
    if (error?.message === 'invalid_date_range') {
      return res.status(400).json({ error: 'invalid_date_range' });
    }
    res.status(500).json({ error: error?.message || 'institution_dashboard_export_failed' });
  }
};
