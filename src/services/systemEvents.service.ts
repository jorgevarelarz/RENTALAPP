import { SystemEvent } from '../models/systemEvent.model';

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
    query.createdAt = {
      ...(filters.dateFrom ? { $gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { $lte: new Date(filters.dateTo) } : {}),
    };
  }
  return query;
}

export async function listSystemEvents(filters: SystemEventFilters) {
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 25)));
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

  return [header, ...rows]
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}
