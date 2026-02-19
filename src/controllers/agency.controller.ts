import type { Request, Response } from 'express';
import { Contract } from '../models/contract.model';
import { Property } from '../models/property.model';

export async function listAgencyProperties(req: Request, res: Response) {
  const u: any = (req as any).user;
  const userId = String(u?.id || u?._id || '');
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  if (u?.role !== 'agency' && u?.role !== 'admin') return res.status(403).json({ error: 'forbidden' });

  const agencyId = u?.role === 'admin' ? String(req.query.agencyId || '') : userId;
  if (u?.role === 'admin' && !agencyId) {
    return res.status(400).json({ error: 'agencyId_required' });
  }

  const props = await Property.find({ agencyId })
    .select('title address city status owner agencyAccess agencyTransferredAt createdAt updatedAt')
    .sort({ updatedAt: -1, _id: -1 })
    .lean();

  const propertyIds = props.map(p => p._id);
  const activeContracts = await Contract.find({ property: { $in: propertyIds }, status: 'active' })
    .select('property lastPaidAt')
    .lean();
  const activeMap = new Map<string, { hasActive: boolean; lastPaidAt?: Date }>();
  for (const c of activeContracts as any[]) {
    const key = String(c.property);
    activeMap.set(key, { hasActive: true, lastPaidAt: c.lastPaidAt });
  }

  const items = props.map((p: any) => {
    const active = activeMap.get(String(p._id));
    return {
      id: String(p._id),
      title: p.title,
      address: p.address,
      city: p.city,
      status: p.status,
      ownerId: p.owner ? String((p.owner as any)?._id || p.owner) : undefined,
      agencyAccess: p.agencyAccess,
      agencyTransferredAt: p.agencyTransferredAt,
      hasActiveContract: !!active?.hasActive,
      lastPaidAt: active?.lastPaidAt,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
    };
  });

  res.json({ items });
}

