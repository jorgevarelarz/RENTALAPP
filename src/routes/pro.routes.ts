import { Router } from 'express';
import { Types } from 'mongoose';
import Pro, { type ProService } from '../models/pro.model';
import { getUserId } from '../utils/getUserId';
import { authorizeRoles } from '../middleware/role.middleware';
import { logger } from '../utils/logger';
import Review from '../models/review.model';
import { User } from '../models/user.model';

const r = Router();

const SERVICE_KEYS: ProService[] = ['plumbing', 'electricity', 'appliances', 'locksmith', 'cleaning', 'painting', 'others'];
const MAX_BASE_PRICE = 100_000;

const cleanText = (value: unknown, min: number, max: number) => {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  return text.length >= min && text.length <= max ? text : null;
};

const ACCENTS: Record<string, string> = { a: '[aá]', e: '[eé]', i: '[ií]', o: '[oó]', u: '[uúü]', n: '[nñ]' };

/** Ciudad exacta sin distinguir mayúsculas ni tildes («malaga» encuentra «Málaga»); el texto va escapado. */
function cityPattern(city: string) {
  const plain = city.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const body = plain
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[aeioun]/g, ch => ACCENTS[ch]);
  return new RegExp(`^${body}$`, 'i');
}

/** Servicios del perfil: claves conocidas, sin repetir, con precio orientativo opcional (0 a 100.000 €). */
function cleanServices(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > SERVICE_KEYS.length) return null;
  const seen = new Set<string>();
  const services: { key: ProService; basePrice?: number }[] = [];
  for (const item of value) {
    const key = item?.key;
    if (typeof key !== 'string' || !SERVICE_KEYS.includes(key as ProService) || seen.has(key)) return null;
    seen.add(key);
    const raw = item.basePrice;
    if (raw === undefined || raw === null || raw === '') {
      services.push({ key: key as ProService });
      continue;
    }
    const price = typeof raw === 'number' ? raw : NaN;
    if (!Number.isFinite(price) || price < 0 || price > MAX_BASE_PRICE) return null;
    services.push({ key: key as ProService, basePrice: Math.round(price * 100) / 100 });
  }
  return services;
}

/**
 * Crear/actualizar perfil PRO del usuario autenticado (solo rol pro; los demás no aparecen en el directorio)
 * Montado en app.ts como /api/pros  → aquí la ruta es "/"
 */
r.post('/', authorizeRoles('pro') as any, async (req, res) => {
  try {
    const userId = getUserId(req);
    const body = req.body || {};
    const displayName = cleanText(body.displayName, 2, 80);
    if (!displayName) return res.status(400).json({ error: 'invalid_display_name', code: 400 });
    const city = cleanText(body.city, 2, 60);
    if (!city) return res.status(400).json({ error: 'invalid_city', code: 400 });
    const services = cleanServices(body.services);
    if (!services) return res.status(400).json({ error: 'invalid_services', code: 400 });
    if (body.active !== undefined && typeof body.active !== 'boolean') {
      return res.status(400).json({ error: 'invalid_active', code: 400 });
    }
    const active = body.active ?? true;

    const pro = await Pro.findOneAndUpdate(
      { userId },
      { $set: { displayName, city, services, active } },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json(pro);
  } catch (err: any) {
    logger.error({ err }, 'pro profile save failed');
    res.status(500).json({ error: 'pro_save_failed', code: 500 });
  }
});

/**
 * Obtener mi perfil PRO
 * Montado en /api/pros → aquí "/me"
 */
r.get('/me', async (req, res) => {
  try {
    const userId = getUserId(req);
    const pro = await Pro.findOne({ userId });
    if (!pro) return res.status(404).json({ error: 'not found', code: 404 });
    res.json(pro);
  } catch (err: any) {
    logger.error({ err }, 'pro read failed');
    res.status(500).json({ error: 'pro_read_failed', code: 500 });
  }
});

/**
 * Listado con filtros y paginación
 * GET /api/pros?service=plumbing&city=Madrid&page=1&limit=10
 */
r.get('/', async (req, res) => {
  try {
    const { service, city } = req.query as any;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '10', 10)));

    const q: any = { active: true };
    if (service !== undefined && typeof service !== 'string') return res.status(400).json({ error: 'invalid_query', code: 400 });
    if (city !== undefined && typeof city !== 'string') return res.status(400).json({ error: 'invalid_query', code: 400 });
    if (service && !SERVICE_KEYS.includes(service as ProService)) return res.status(400).json({ error: 'invalid_query', code: 400 });
    if (service) q['services.key'] = service;
    if (city) q.city = cityPattern(city);

    const [items, total] = await Promise.all([
      Pro.find(q)
        .sort({ ratingAvg: -1, reviewCount: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Pro.countDocuments(q),
    ]);

    res.json({ items, total, page, limit });
  } catch (err: any) {
    logger.error({ err }, 'pro read failed');
    res.status(500).json({ error: 'pro_read_failed', code: 500 });
  }
});

/**
 * Obtener PRO por id
 * GET /api/pros/:id
 */
r.get('/:id', async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'not found', code: 404 });
    const pro = await Pro.findById(req.params.id);
    if (!pro) return res.status(404).json({ error: 'not found', code: 404 });
    res.json(pro);
  } catch (err: any) {
    logger.error({ err }, 'pro read failed');
    res.status(500).json({ error: 'pro_read_failed', code: 500 });
  }
});

/** «Laura M.»: nombre y la inicial del primer apellido; nunca el nombre completo ni el correo. */
export function reviewerLabel(name: unknown) {
  const parts = typeof name === 'string' ? name.trim().split(/\s+/).filter(Boolean) : [];
  if (parts.length === 0) return 'Usuario de RentalApp';
  const first = parts[0].slice(0, 30);
  return parts[1] ? `${first} ${parts[1].charAt(0).toUpperCase()}.` : first;
}

/**
 * Opiniones del profesional, las más recientes primero
 * GET /api/pros/:id/reviews?page=1&limit=5
 */
r.get('/:id/reviews', async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'not found', code: 404 });
    const pro = await Pro.findById(req.params.id).select('userId').lean();
    if (!pro) return res.status(404).json({ error: 'not found', code: 404 });
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
    const limit = Math.min(20, Math.max(1, parseInt((req.query.limit as string) || '5', 10) || 5));

    const q = { toUserId: String(pro.userId), roleContext: 'pro' };
    const [reviews, total] = await Promise.all([
      Review.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('fromUserId score comment createdAt').lean(),
      Review.countDocuments(q),
    ]);
    const authorIds = reviews.map(rv => rv.fromUserId).filter(id => Types.ObjectId.isValid(id));
    const authors = await User.find({ _id: { $in: authorIds } }).select('name').lean();
    const names = new Map(authors.map(u => [String(u._id), (u as any).name]));

    res.json({
      items: reviews.map(rv => ({
        id: String(rv._id),
        score: rv.score,
        comment: rv.comment || undefined,
        createdAt: rv.createdAt,
        author: reviewerLabel(names.get(rv.fromUserId)),
      })),
      total,
      page,
      limit,
    });
  } catch (err: any) {
    logger.error({ err }, 'pro reviews read failed');
    res.status(500).json({ error: 'pro_read_failed', code: 500 });
  }
});

export default r;
