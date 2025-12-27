import { Request, Response } from 'express';
import { Application } from '../models/application.model';
import { Property } from '../models/property.model';

export async function listMyApplications(req: Request, res: Response) {
  const user: any = (req as any).user;
  const userId = user?._id || user?.id;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const apps = await Application.find({ tenantId: userId })
    .sort({ createdAt: -1 })
    .populate('propertyId', 'title address city price images')
    .lean();

  const items = apps.map((a: any) => ({
    _id: a._id,
    status: a.status,
    createdAt: a.createdAt,
    proposedDate: a.proposedDate,
    proposedBy: a.proposedBy,
    visitDate: a.visitDate,
    property: a.propertyId ? {
      _id: a.propertyId._id,
      title: a.propertyId.title,
      address: a.propertyId.address,
      city: a.propertyId.city,
      price: a.propertyId.price,
      images: a.propertyId.images,
    } : undefined,
  }));

  res.json({ items });
}

export async function proposeVisit(req: Request, res: Response) {
  const user: any = (req as any).user;
  const userId = user?._id || user?.id;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const { id } = req.params;
  const { visitDate } = req.body || {};
  if (!visitDate) return res.status(400).json({ error: 'visitDate_required' });

  const app = await Application.findById(id);
  if (!app) return res.status(404).json({ error: 'application_not_found' });

  const property = await Property.findById(app.propertyId);
  if (!property) return res.status(404).json({ error: 'property_not_found' });

  const isOwner = String(property.owner) === String(userId);
  const isTenant = String(app.tenantId) === String(userId);
  const isAdmin = user?.role === 'admin';
  if (!isOwner && !isTenant && !isAdmin) return res.status(403).json({ error: 'forbidden' });

  app.proposedDate = new Date(visitDate);
  app.proposedBy = isOwner || isAdmin ? 'landlord' : 'tenant';
  app.status = 'proposed';
  await app.save();

  res.json({
    ok: true,
    _id: app._id,
    status: app.status,
    proposedDate: app.proposedDate,
    proposedBy: app.proposedBy,
  });
}

export async function acceptProposedVisit(req: Request, res: Response) {
  const user: any = (req as any).user;
  const userId = user?._id || user?.id;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const { id } = req.params;
  const app = await Application.findById(id);
  if (!app) return res.status(404).json({ error: 'application_not_found' });

  if (!app.proposedDate || !app.proposedBy) {
    return res.status(409).json({ error: 'no_proposed_date' });
  }

  const property = await Property.findById(app.propertyId);
  if (!property) return res.status(404).json({ error: 'property_not_found' });

  const isOwner = String(property.owner) === String(userId);
  const isTenant = String(app.tenantId) === String(userId);
  const isAdmin = user?.role === 'admin';
  if (!isOwner && !isTenant && !isAdmin) return res.status(403).json({ error: 'forbidden' });

  if ((app.proposedBy === 'tenant' && !isOwner && !isAdmin) ||
      (app.proposedBy === 'landlord' && !isTenant && !isAdmin)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  app.visitDate = app.proposedDate;
  app.status = 'scheduled';
  app.proposedDate = undefined;
  app.proposedBy = undefined;
  await app.save();

  res.json({ ok: true, _id: app._id, status: app.status, visitDate: app.visitDate });
}
