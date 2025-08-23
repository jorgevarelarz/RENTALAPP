import { Router } from 'express';
import Pro from '../models/pro.model';
import { getUserId } from '../utils/getUserId';
import { requireVerified } from '../middleware/requireVerified';

const r = Router();

// Alta/edición PRO del usuario autenticado
r.post('/', requireVerified, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { displayName, city, services = [], verified } = req.body || {};
    if (!displayName || !city) {
      return res.status(400).json({ error: 'displayName and city are required', code: 400 });
    }
    const pro = await Pro.findOneAndUpdate(
      { userId },
      { $set: { displayName, city, services, verified: !!verified, active: true } },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json(pro);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

// Obtener mi perfil PRO
r.get('/me', requireVerified, async (req, res) => {
  try {
    const userId = getUserId(req);
    const pro = await Pro.findOne({ userId });
    if (!pro) return res.status(404).json({ error: 'not found', code: 404 });
    res.json(pro);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

// Listado con filtros y paginación
r.get('/', async (req, res) => {
  try {
    const { service, city } = req.query as any;
    let page = Math.max(1, parseInt((req.query.page as string) || '1'));
    let limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '10')));
    const q: any = { active: true };
    if (service) q['services.key'] = service;
    if (city) q.city = new RegExp(`^${city}$`, 'i');
    const [items, total] = await Promise.all([
      Pro.find(q).sort({ ratingAvg: -1, reviewCount: -1 }).skip((page - 1) * limit).limit(limit),
      Pro.countDocuments(q)
    ]);
    res.json({ items, total, page, limit });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

// Obtener PRO por id
r.get('/:id', async (req, res) => {
  try {
    const pro = await Pro.findById(req.params.id);
    if (!pro) return res.status(404).json({ error: 'not found', code: 404 });
    res.json(pro);
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: 500 });
  }
});

export default r;
