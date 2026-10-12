import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Property } from '../models/property.model';
import { UserFavorite } from '../models/userFavorite.model';
import { AlertSubscription } from '../models/alertSubscription.model';
import { sendAvailabilityAlert, sendPriceAlert } from '../utils/email';
import { User } from '../models/user.model';
import { Application } from '../models/application.model';
import { buildAreaKey, TensionedArea } from '../modules/rentalPublic';
import { SystemEvent } from '../models/systemEvent.model';
import { emitSystemEvent } from '../events/system.events';
import { recordFunnelEvent } from '../services/funnelEvents.service';
import { suggestRent } from '../services/rentSuggestion.service';
import { isManagingAgency } from '../utils/propertyAccess';
import { notifyApplication } from '../services/applicationNotice.service';

const tensionedAreaDateQuery = (changeDate: Date) => ({
  active: true,
  effectiveFrom: { $lte: changeDate },
  $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: changeDate } }],
});

// Las suscripciones guardan el usuario; el aviso va a su email.
async function subscriberEmails(propertyId: string, type: 'price' | 'availability') {
  const subs = await AlertSubscription.find({ propertyId, type }).select('userId').lean();
  if (subs.length === 0) return [];
  const users = await User.find({ _id: { $in: subs.map((s) => s.userId) } })
    .select('email')
    .lean();
  return users.map((u) => u.email).filter((email): email is string => Boolean(email));
}

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
  const user: any = req.user;
  const userId = user?._id ?? user?.id;
  if (user?.role === 'agency' && userId) {
    payload.agencyId = userId;
    payload.agencyAccess = 'manage';
  }
  if (user?.role === 'landlord' && userId) {
    const dbUser: any = await User.findById(userId).select('referredByAgencyId').lean();
    if (dbUser?.referredByAgencyId) {
      payload.refAgencyId = dbUser.referredByAgencyId;
    }
  }
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
  const isAgencyManager =
    user?.role === 'agency' &&
    prev.agencyAccess === 'manage' &&
    userId &&
    prev.agencyId &&
    String(prev.agencyId) === String(userId);
  if (!isAdmin && !isOwner && !isAgencyManager) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const b: any = { ...req.body };
  delete b._id;
  delete b.owner;
  delete b.createdBy;
  delete b.createdAt;
  delete b.updatedAt;
  delete b.agencyId;
  delete b.agencyAccess;
  delete b.agencyTransferredAt;
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
    for (const email of await subscriberEmails(id, 'price')) {
      await sendPriceAlert(email, updated);
    }
  }

  if (availabilityChanged) {
    for (const email of await subscriberEmails(id, 'availability')) {
      await sendAvailabilityAlert(email, updated);
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
  const isAgencyManager =
    user?.role === 'agency' &&
    p.agencyAccess === 'manage' &&
    userId &&
    p.agencyId &&
    String(p.agencyId) === String(userId);
  if (!isAdmin && !isAgencyManager && (!isOwner || !user?.isVerified)) {
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
  const isAgencyManager =
    user?.role === 'agency' &&
    p.agencyAccess === 'manage' &&
    userId &&
    p.agencyId &&
    String(p.agencyId) === String(userId);
  if (!isAdmin && !isOwner && !isAgencyManager) {
    return res.status(403).json({ error: 'forbidden' });
  }
  p.status = 'archived';
  await p.save();
  res.json({ _id: p._id, status: p.status });
}

export async function handoffToOwner(req: Request, res: Response) {
  const p = await Property.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const user: any = req.user;
  const userId = user?._id ?? user?.id;
  const isAdmin = user?.role === 'admin';
  const isAgencyOwner =
    user?.role === 'agency' &&
    userId &&
    p.agencyId &&
    String(p.agencyId) === String(userId);
  if (!isAdmin && !isAgencyOwner) {
    return res.status(403).json({ error: 'forbidden' });
  }

  p.agencyAccess = 'status_only';
  p.agencyTransferredAt = new Date();
  await p.save();
  res.json({ ok: true, propertyId: String(p._id), agencyAccess: p.agencyAccess, transferredAt: p.agencyTransferredAt });
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORTABLE_FIELDS = new Set(['createdAt', 'price', 'sizeM2', 'rooms', 'availableFrom', 'viewsCount']);

/** Quién ve qué: admin todo; con sesión, los activos y los propios; anónimo, solo los activos. */
const visibilityFilter = (req: Request): Record<string, unknown> | null => {
  const user: any = (req as any).user;
  if (user?.role === 'admin') return null;
  const userId = user?.id || user?._id;
  if (!userId) return { status: 'active' };
  return { $or: [{ status: 'active' }, { owner: userId }, { agencyId: userId }] };
};

// Campos internos del anuncio: quién lo gestiona y su historial no son para cualquiera que lo vea
const PRIVATE_PROPERTY_FIELDS = ['owner', 'agencyId', 'refAgencyId', 'agencyAccess', 'agencyTransferredAt', 'history'];

const viewerId = (req: Request) => String((req as any).user?.id || (req as any).user?._id || '');

const canManageProperty = (req: Request, p: any) => {
  if ((req as any).user?.role === 'admin') return true;
  const userId = viewerId(req);
  return !!userId && (String(p.owner) === userId || String(p.agencyId || '') === userId);
};

const toPropertyView = (req: Request, p: any) => {
  const o = typeof p?.toObject === 'function' ? p.toObject() : { ...p };
  if (canManageProperty(req, p)) return o;
  for (const field of PRIVATE_PROPERTY_FIELDS) delete o[field];
  return o;
};

export async function getById(req: Request, res: Response) {
  if (!Types.ObjectId.isValid(String(req.params.id))) return res.status(404).json({ error: 'not_found' });
  const p = await Property.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const mine = canManageProperty(req, p);
  if (p.status !== 'active' && !mine) return res.status(404).json({ error: 'not_found' });

  const view: any = toPropertyView(req, p);
  view._mine = mine;
  const userId = viewerId(req);
  if (userId && Types.ObjectId.isValid(userId)) {
    const [fav, application] = await Promise.all([
      UserFavorite.exists({ userId, propertyId: p._id }),
      (req as any).user?.role === 'tenant'
        ? Application.findOne({ propertyId: p._id, tenantId: userId }).select('status visitDate proposedDate proposedBy message createdAt').lean()
        : null,
    ]);
    view._liked = !!fav;
    if (application) {
      const a: any = application;
      view._application = {
        status: a.status,
        createdAt: a.createdAt,
        visitDate: a.visitDate,
        proposedDate: a.proposedDate,
        proposedBy: a.proposedBy,
        message: a.message,
      };
    }
  }
  res.json(view);
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
  // Valores de query forzados a string: ?city[$regex]=. no debe llegar como operador.
  // La ciudad entera, sin distinguir mayúsculas: «madrid» encuentra «Madrid»
  const cityText = city ? escapeRegExp(String(city).trim().slice(0, 100)) : '';
  if (cityText) q.city = { $regex: `^${cityText}$`, $options: 'i' };
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
  const and: Record<string, unknown>[] = [];
  const visibility = visibilityFilter(req);
  if (visibility) and.push(visibility);
  if (text) {
    // Texto escapado y acotado: sin esto, ?q=(a+)+$ es una regex arbitraria contra toda la colección
    const safe = escapeRegExp(String(text).trim().slice(0, 100));
    if (safe) {
      and.push({
        $or: [
          { title: { $regex: safe, $options: 'i' } },
          { city: { $regex: safe, $options: 'i' } },
          { address: { $regex: safe, $options: 'i' } },
        ],
      });
    }
  }
  if (and.length) q.$and = and;

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

  const sortField = SORTABLE_FIELDS.has(String(sort)) ? String(sort) : 'createdAt';
  const sortSpec: [string, 1 | -1][] = [[sortField, String(dir).toLowerCase() === 'asc' ? 1 : -1]];
  const pg = Math.max(1, parseInt(String(page)) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(String(limit)) || 20));

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

  await recordFunnelEvent(req, 'search', {
    meta: { city, region, priceMin, priceMax, roomsMin, roomsMax, onlyTenantPro: onlyProParam, total },
  });

  res.json({ items: items.map((p) => toPropertyView(req, p)), page: pg, limit: lim, total });
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
  // Un guardado que su dueño ha retirado o devuelto a borrador deja de verse, como en la ficha
  const items = rows
    .map((row: any) => row.propertyId)
    .filter((p: any) => p && (p.status === 'active' || canManageProperty(req, p)))
    .map((p: any) => ({ ...toPropertyView(req, p), _liked: true }));
  res.json({ items });
}

const MINE_STATUSES = new Set(['draft', 'active', 'archived']);

// Inmuebles que gestiona quien pide (dueño o agencia), con borradores y retirados, paginados
export async function listMine(req: Request, res: Response) {
  const userId = viewerId(req);
  if (!Types.ObjectId.isValid(userId)) return res.status(401).json({ error: 'unauthorized' });
  const { status, page = '1', limit = '50' } = req.query as any;
  const q: any = { $or: [{ owner: userId }, { agencyId: userId }] };
  if (status !== undefined) {
    if (!MINE_STATUSES.has(String(status))) return res.status(400).json({ error: 'invalid_status' });
    q.status = String(status);
  }
  const pg = Math.max(1, parseInt(String(page)) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
  const [items, total] = await Promise.all([
    Property.find(q).sort({ createdAt: -1, _id: -1 }).skip((pg - 1) * lim).limit(lim),
    Property.countDocuments(q),
  ]);
  res.json({ items: items.map((p) => toPropertyView(req, p)), page: pg, limit: lim, total });
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
  if (!Types.ObjectId.isValid(String(req.params.id))) return res.status(404).json({ error: 'not_found' });
  // Solo cuentan las visitas a anuncios publicados
  const r = await Property.updateOne({ _id: req.params.id, status: 'active' }, { $inc: { viewsCount: 1 } });
  if (!r.matchedCount) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
}

export const APPLICATION_MESSAGE_MAX = 1000;

// Mensaje opcional del inquilino al solicitar visita: texto plano, sin caracteres de control
// (salvo saltos de línea), sin más de una línea en blanco seguida y recortado
export function cleanApplicationMessage(raw: unknown): { message?: string; error?: string } {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'string') return { error: 'invalid_message' };
  const message = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (message.length > APPLICATION_MESSAGE_MAX) return { error: 'message_too_long' };
  return message ? { message } : {};
}

export async function apply(req: Request, res: Response) {
  if (!Types.ObjectId.isValid(String(req.params.id))) return res.status(404).json({ error: 'not_found' });
  const { message, error: messageError } = cleanApplicationMessage(req.body?.message);
  if (messageError) return res.status(400).json({ error: messageError, max: APPLICATION_MESSAGE_MAX });
  const property = await Property.findById(req.params.id);
  // Un borrador o un anuncio retirado no admite solicitudes (y para quien no lo gestiona, no existe)
  if (!property || property.status !== 'active') return res.status(404).json({ error: 'not_found' });

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
    await recordFunnelEvent(req, 'application', {
      resourceType: 'application',
      resourceId: String(existing._id),
      meta: { propertyId: String(property._id), reused: true },
    });
    return res.json({ ok: true, applicationId: existing._id });
  }

  const app = await Application.create({
    propertyId: property._id,
    tenantId: userId,
    status: 'pending',
    ...(message ? { message } : {}),
  });

  await recordFunnelEvent(req, 'application', {
    resourceType: 'application',
    resourceId: String(app._id),
    meta: { propertyId: String(property._id) },
  });

  res.json({ ok: true, propertyId: property._id, applicationId: app._id });
  // Aviso al propietario y a su agencia gestora; no retrasa la respuesta y nunca lanza
  void notifyApplication('received', app._id, userId);
}

export async function listApplications(req: Request, res: Response) {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(String(id))) return res.status(404).json({ error: 'not_found' });
  const property = await Property.findById(id);
  if (!property) return res.status(404).json({ error: 'not_found' });

  const user: any = (req as any).user;
  const userId = user?._id || user?.id;
  const isOwner = userId && String(userId) === String(property.owner);
  const isAdmin = user?.role === 'admin';
  if (!isOwner && !isAdmin && !isManagingAgency(user, property)) return res.status(403).json({ error: 'forbidden' });

  const apps = await Application.find({ propertyId: property._id })
    .sort({ createdAt: -1 })
    .populate('tenantId', 'name email tenantPro.status tenantPro.maxRent tenantPro.isActive')
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
      // Solo el resultado de la verificación; los documentos y la auditoría no son para el arrendador
      tenantPro: a.tenantId.tenantPro
        ? { status: a.tenantId.tenantPro.status, maxRent: a.tenantId.tenantPro.maxRent, isActive: a.tenantId.tenantPro.isActive }
        : undefined,
    } : undefined,
  }));

  res.json({ items });
}

export async function suggestPrice(req: Request, res: Response) {
  const body = req.body || {};
  const sizeM2 = Number(body.sizeM2);
  const region = String(body.region || '').trim();
  const city = String(body.city || '').trim();

  if (!region || !city) {
    return res.status(400).json({ error: 'region_and_city_required' });
  }
  if (!Number.isFinite(sizeM2) || sizeM2 <= 0) {
    return res.status(400).json({ error: 'size_required' });
  }

  const lat = Number(body?.location?.lat);
  const lng = Number(body?.location?.lng);

  const suggestion = await suggestRent({
    region,
    city,
    sizeM2,
    location: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined,
    condition: body.condition,
    furnished: Boolean(body.furnished),
    floor: Number.isFinite(Number(body.floor)) ? Number(body.floor) : undefined,
    hasElevator: typeof body.hasElevator === 'boolean' ? body.hasElevator : undefined,
    yearBuilt: Number.isFinite(Number(body.yearBuilt)) ? Number(body.yearBuilt) : undefined,
    excludePropertyId: typeof body.propertyId === 'string' ? body.propertyId : undefined,
  });

  if (!suggestion) {
    return res.json({ suggestion: null, reason: 'not_enough_data' });
  }

  return res.json({ suggestion });
}
