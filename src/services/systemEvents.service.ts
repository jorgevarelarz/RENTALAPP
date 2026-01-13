import { SystemEvent } from '../models/systemEvent.model';

export type SystemEventFilters = {
  type?: string;
  resourceType?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  page?: number | string;
  pageSize?: number | string;
};

export async function listSystemEvents(filters: SystemEventFilters) {
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 25)));

  const query: any = {};
  if (filters.type) query.type = filters.type;
  if (filters.resourceType) query.resourceType = filters.resourceType;
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {
      ...(filters.dateFrom ? { $gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { $lte: new Date(filters.dateTo) } : {}),
    };
  }

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
