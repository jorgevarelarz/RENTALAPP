import { SystemEvent } from '../models/systemEvent.model';
import { csvRows } from '../utils/csv';
import { parseDateRange } from '../utils/dateRange';

export type SystemEventFilters = {
  type?: string;
  resourceType?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  page?: number | string;
  pageSize?: number | string;
};

function buildSystemEventsQuery(filters: SystemEventFilters) {
  const query: any = {};
  if (filters.type) query.type = filters.type;
  if (filters.resourceType) query.resourceType = filters.resourceType;
  if (filters.dateFrom || filters.dateTo) {
    // «Hasta 2026-10-12» incluye todo ese día; una fecha no válida o un rango al revés es un 400
    const parsed = parseDateRange({ dateFrom: filters.dateFrom, dateTo: filters.dateTo });
    if ('error' in parsed) throw new Error('invalid_date_range');
    query.createdAt = {
      ...(parsed.from ? { $gte: parsed.from } : {}),
      ...(parsed.to ? { $lte: parsed.to } : {}),
    };
  }
  return query;
}

// `?page=abc` daba NaN y Mongo fallaba con un 500
function positiveInt(value: unknown, fallback: number) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

export async function listSystemEvents(filters: SystemEventFilters) {
  const page = positiveInt(filters.page, 1);
  const pageSize = Math.min(100, positiveInt(filters.pageSize, 25));
  const query = buildSystemEventsQuery(filters);

  const [total, items] = await Promise.all([
    SystemEvent.countDocuments(query),
    SystemEvent.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  return { items, total, page, pageSize };
}

export async function listSystemEventsAll(filters: SystemEventFilters) {
  const query = buildSystemEventsQuery(filters);
  return SystemEvent.find(query).sort({ createdAt: -1 }).lean();
}

export function buildSystemEventsCsv(items: any[]) {
  const header = ['createdAt', 'type', 'resourceType', 'resourceId', 'requestId', 'userId', 'ip', 'meta'];
  const rows = items.map(item => {
    const payload = (item.payload || {}) as Record<string, any>;
    const requestId = payload.requestId || '';
    const userId = payload.userId || '';
    const ip = payload.ip || '';
    const meta = JSON.stringify(payload);
    return [
      item.createdAt ? new Date(item.createdAt).toISOString() : '',
      item.type || '',
      item.resourceType || '',
      item.resourceId || '',
      requestId,
      userId,
      ip,
      meta,
    ];
  });

  return csvRows([header, ...rows]);
}
