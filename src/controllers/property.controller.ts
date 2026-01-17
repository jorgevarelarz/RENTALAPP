import { Request, Response } from 'express';
import { Property } from '../models/property.model';
import { UserFavorite } from '../models/userFavorite.model';
import { AlertSubscription } from '../models/alertSubscription.model';
import { sendAvailabilityAlert, sendPriceAlert } from '../utils/email';
import { User } from '../models/user.model';
import { Application } from '../models/application.model';
import { buildAreaKey, TensionedArea } from '../modules/rentalPublic';
import { SystemEvent } from '../models/systemEvent.model';
import { emitSystemEvent } from '../events/system.events';

const tensionedAreaDateQuery = (changeDate: Date) => ({
  active: true,
  effectiveFrom: { $lte: changeDate },
  $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: changeDate } }],
});

const isGeoPoint = (value: any): value is { type: 'Point'; coordinates: [number, number] } =>
  value?.type === 'Point' &&
  Array.isArray(value.coordinates) &&
  value.coordinates.length === 2 &&
  value.coordinates.every((entry: unknown) => typeof entry === 'number');

async function findTensionedAreaForProperty(property: any, changeDate: Date) {
  const areaKeyFallback = buildAreaKey(property.region, property.city, property.zoneCode);
  const geoPoint = property.location;
  const dateQuery = tensionedAreaDateQuery(changeDate);

  if (isGeoPoint(geoPoint)) {
    const byGeo = await TensionedArea.findOne({
      geometry: { $geoIntersects: { $geometry: geoPoint } },
      ...dateQuery,
    })
      .sort({ effectiveFrom: -1 })
      .lean();
    if (byGeo) {
      return { tensionedArea: byGeo, areaKey: byGeo.areaKey || areaKeyFallback };
    }
  }

  const byAreaKey = await TensionedArea.findOne({
    areaKey: areaKeyFallback,
    ...dateQuery,
  })
    .sort({ effectiveFrom: -1 })
    .lean();

  return { tensionedArea: byAreaKey, areaKey: byAreaKey?.areaKey || areaKeyFallback };
}

async function buildTensionedAreaWarnings(property: any) {
  const warnings: { code: string; message: string; limit?: number }[] = [];
  try {
    const { tensionedArea, areaKey } = await findTensionedAreaForProperty(property, new Date());
    if (tensionedArea && typeof (tensionedArea as any).maxRent === 'number') {
      const limit = (tensionedArea as any).maxRent as number;
      warnings.push({
        code: 'tensioned_area_price_limit',
        message: `Zona tensionada. Limite recomendado: ${limit} EUR`,
        limit,
      });

      if (typeof property.price === 'number' && property.price > limit) {
        const owner = await User.findById(property.owner).select('name email').lean();
        const payload = {
          type: 'LISTING_PRICE_LIMIT_EXCEEDED',
          resourceType: 'property',
          resourceId: String(property._id),
          payload: {
            ownerId: String(property.owner),
            ownerName: owner?.name,
            ownerEmail: owner?.email,
            propertyId: String(property._id),
            price: property.price,
            limit,
            areaKey,
            tensionedAreaId: tensionedArea._id,
          },
        };

        await SystemEvent.updateOne(
          { type: payload.type, resourceType: payload.resourceType, resourceId: payload.resourceId },
          { $setOnInsert: { ...payload, createdAt: new Date() }, $set: { updatedAt: new Date() } },
          { upsert: true },
        );
        emitSystemEvent({ ...payload, createdAt: new Date().toISOString() });
      }
    }
  } catch (error) {
    // Silence failures to avoid changing publication UX.
  }

  return warnings;
}

export async function create(req: Request, res: Response) {
  const b: any = req.body;
  const coords: [number, number] = [b.location.lng, b.location.lat];
  const payload: any = { ...b, location: { type: 'Point', coordinates: coords }, status: 'draft' };
  if (payload.onlyTenantPro && (!payload.requiredTenantProMaxRent || payload.requiredTenantProMaxRent === 0)) {
    payload.requiredTenantProMaxRent = payload.price;
  }
  const doc = await Property.create(payload);
  res.status(201).json(doc);
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const prev = await Property.findById(id);
  if (!prev) return res.status(404).json({ error: 'not_found' });
  const user: any = req.user;
  const userId = user?._id ?? user?.id;
  const isAdmin = user?.role === 'admin';
  const ownerId = (prev as any).owner?._id ?? prev.owner;
  const isOwner = userId ? String(userId) === String(ownerId) : false;
  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const b: any = { ...req.body };
  delete b._id;
  delete b.owner;
  delete b.createdBy;
  delete b.createdAt;
  delete b.updatedAt;
  if (!isAdmin) delete b.status;
  if (b.location) b.location = { type: 'Point', coordinates: [b.location.lng, b.location.lat] };

  if (b.onlyTenantPro) {
    const required = Number(b.requiredTenantProMaxRent ?? 0);
    if (!required) {
      b.requiredTenantProMaxRent = b.price ?? prev.price;
    }
  }

  const updated = await Property.findByIdAndUpdate(id, b, { new: true, runValidators: true });
  if (!updated) return res.status(404).json({ error: 'not_found' });

  const priceChanged = prev.price !== updated.price;

  const prevAvailableFrom = prev.availableFrom ? String(prev.availableFrom) : null;
  const updatedAvailableFrom = updated.availableFrom ? String(updated.availableFrom) : null;
  const prevAvailableTo = prev.availableTo ? String(prev.availableTo) : null;
  const updatedAvailableTo = updated.availableTo ? String(updated.availableTo) : null;
  const availabilityChanged =
    prevAvailableFrom !== updatedAvailableFrom || prevAvailableTo !== updatedAvailableTo;

  if (priceChanged) {
    const subs = await AlertSubscription.find({ propertyId: id, type: 'price' });
    for (const s of subs) {
      await sendPriceAlert(String(s.userId), updated);
    }
  }

  if (availabilityChanged) {
    const subs = await AlertSubscription.find({ propertyId: id, type: 'availability' });
    for (const s of subs) {
      await sendAvailabilityAlert(String(s.userId), updated);
    }
  }

  const warnings = priceChanged ? await buildTensionedAreaWarnings(updated) : [];
  if (warnings.length > 0) {
    return res.json({ ...updated.toObject(), warnings });
  }
  res.json(updated);
}

export async function publish(req: Request, res: Response) {
  const { id } = req.params;
  const p = await Property.findById(id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const user: any = (req as any).user;
  const userId = user?._id ?? user?.id;
  const isOwner = userId ? String(userId) === String(p.owner) : false;
  const isAdmin = user?.role === 'admin';
  if (!isAdmin && (!isOwner || !user?.isVerified)) {
    return res.status(403).json({ error: 'owner_not_verified' });
  }
  if ((p.images?.length || 0) < 3) return res.status(400).json({ error: 'min_images_3' });
  p.status = 'active';
  await p.save();

  const warnings = await buildTensionedAreaWarnings(p);
  if (warnings.length > 0) {
    return res.json({ _id: p._id, status: p.status, warnings });
  }
  res.json({ _id: p._id, status: p.status });
}

export async function archive(req: Request, res: Response) {
  const p = await Property.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const user: any = req.user;
  const userId = user?._id ?? user?.id;
  const isAdmin = user?.role === 'admin';
  const ownerId = (p as any).owner?._id ?? p.owner;
  const isOwner = userId ? String(userId) === String(ownerId) : false;
  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: 'forbidden' });
  }
  p.status = 'archived';
  await p.save();
  res.json({ _id: p._id, status: p.status });
}

export async function getById(req: Request, res: Response) {
  const p = await Property.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  res.json(p);
}

export async function search(req: Request, res: Response) {
  const q: any = {};
  const {
    q: text,
    region,
    city,
    priceMin,
    priceMax,
    roomsMin,
    roomsMax,
    bathMin,
    furnished,
    petsAllowed,
    availableDate,
    nearLng,
    nearLat,
    maxKm,
    sort = 'createdAt',
    dir = 'desc',
    page = '1',
    limit = '20',
    onlyTenantPro,
    onlyPro,
    status,
  } = req.query as any;

  if (region) q.region = String(region).toLowerCase();
  if (city) q.city = city;
  if (priceMin || priceMax) q.price = { ...(priceMin ? { $gte: +priceMin } : {}), ...(priceMax ? { $lte: +priceMax } : {}) };
  if (roomsMin || roomsMax) q.rooms = { ...(roomsMin ? { $gte: +roomsMin } : {}), ...(roomsMax ? { $lte: +roomsMax } : {}) };
  if (bathMin) q.bathrooms = { $gte: +bathMin };
  if (furnished !== undefined) q.furnished = furnished === 'true';
  if (petsAllowed !== undefined) q.petsAllowed = petsAllowed === 'true';
  if (availableDate) q.availableFrom = { $lte: new Date(String(availableDate)) };
  const onlyProParam =
    onlyTenantPro !== undefined ? onlyTenantPro : (onlyPro !== undefined ? onlyPro : undefined);
  if (onlyProParam !== undefined) {
    q.onlyTenantPro = ['true', '1', 'yes', 'on'].includes(String(onlyProParam).toLowerCase());
  }
  if (status) q.status = String(status);
  if (text) {
    const safe = String(text).trim();
    if (safe) {
      q.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { city: { $regex: safe, $options: 'i' } },
        { address: { $regex: safe, $options: 'i' } },
      ];
    }
  }

  let geo: any = {};
  if (nearLng && nearLat && maxKm) {
    geo = {
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [Number(nearLng), Number(nearLat)] },
          $maxDistance: Number(maxKm) * 1000,
        },
      },
    };
  }

  const sortSpec: [string, 1 | -1][] = [[String(sort), String(dir).toLowerCase() === 'asc' ? 1 : -1]];
  const pg = Math.max(1, parseInt(String(page)));
  const lim = Math.min(50, Math.max(1, parseInt(String(limit))));

  const hasGeo = Boolean((geo as any).location);
  if (hasGeo) {
    await Property.init();
  }

  const finder = Property.find({ ...q, ...geo });
  if (!hasGeo) {
    finder.sort(sortSpec);
  }

  const items = await finder.skip((pg - 1) * lim).limit(lim);
  const total = hasGeo ? items.length : await Property.countDocuments({ ...q, ...geo });

  res.json({ items, page: pg, limit: lim, total });
}

export async function favorite(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const { id: propertyId } = req.params;
  const result = await UserFavorite.updateOne({ userId, propertyId }, {}, { upsert: true });
  if (result.upsertedCount) {
    await Property.findByIdAndUpdate(propertyId, { $inc: { favoritesCount: 1 } });
  }
  res.json({ ok: true });
}

export async function unfavorite(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const { id: propertyId } = req.params;
  const del = await UserFavorite.deleteOne({ userId, propertyId });
  if (del.deletedCount) await Property.findByIdAndUpdate(propertyId, { $inc: { favoritesCount: -1 } });
  res.json({ ok: true });
}

export async function listMyFavorites(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const rows = await UserFavorite.find({ userId })
    .sort({ createdAt: -1 })
    .populate('propertyId')
    .lean();
  const items = rows
    .map((row: any) => row.propertyId)
    .filter(Boolean)
    .map((p: any) => ({ ...p, _liked: true }));
  res.json({ items });
}

export async function subscribePriceAlert(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const { id: propertyId } = req.params;
  await AlertSubscription.updateOne({ userId, propertyId, type: 'price' }, {}, { upsert: true });
  res.json({ ok: true });
}

export async function unsubscribePriceAlert(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const { id: propertyId } = req.params;
  await AlertSubscription.deleteOne({ userId, propertyId, type: 'price' });
  res.json({ ok: true });
}

export async function countView(req: Request, res: Response) {
  await Property.findByIdAndUpdate(req.params.id, { $inc: { viewsCount: 1 } });
  res.json({ ok: true });
}

export async function apply(req: Request, res: Response) {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ error: 'not_found' });

  if (property.onlyTenantPro) {
    const required = property.requiredTenantProMaxRent || property.price;
    const userId = (req as any).user?._id || (req as any).user?.id;
    const userDoc: any = userId ? await User.findById(userId) : null;
    const userMax = userDoc?.tenantPro?.maxRent || 0;
    if (!userDoc?.tenantPro || userDoc.tenantPro.status !== 'verified' || userMax < required) {
      return res.status(403).json({
        error: 'ONLY_TENANT_PRO',
        message: `Requiere inquilino PRO ≥ ${required} €/mes. Tu validación: ${userMax} €/mes.`,
      });
    }
  }

  const userId = (req as any).user?._id || (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const existing = await Application.findOne({ propertyId: property._id, tenantId: userId });
  if (existing) {
    return res.json({ ok: true, applicationId: existing._id });
  }

  const app = await Application.create({
    propertyId: property._id,
    tenantId: userId,
    status: 'pending',
  });

  res.json({ ok: true, propertyId: property._id, applicationId: app._id });
}

export async function listApplications(req: Request, res: Response) {
  const { id } = req.params;
  const property = await Property.findById(id);
  if (!property) return res.status(404).json({ error: 'not_found' });

  const user: any = (req as any).user;
  const userId = user?._id || user?.id;
  const isOwner = userId && String(userId) === String(property.owner);
  const isAdmin = user?.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'forbidden' });

  const apps = await Application.find({ propertyId: property._id })
    .sort({ createdAt: -1 })
    .populate('tenantId', 'name email tenantPro')
    .lean();

  const items = apps.map((a: any) => ({
    _id: a._id,
    status: a.status,
    createdAt: a.createdAt,
    message: a.message,
    proposedDate: a.proposedDate,
    proposedBy: a.proposedBy,
    visitDate: a.visitDate,
    tenant: a.tenantId ? {
      _id: a.tenantId._id,
      name: a.tenantId.name,
      email: a.tenantId.email,
      tenantPro: a.tenantId.tenantPro,
    } : undefined,
  }));

  res.json({ items });
}
