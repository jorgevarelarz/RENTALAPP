import { Router } from 'express';
import Pro from '../models/pro.model';
import { getUserId } from '../utils/getUserId';
const r = Router();

// Alta/edición PRO del usuario autenticado
r.post('/pros', async (req, res) => {
  const userId = getUserId(req);
  const { displayName, city, services, verified } = req.body || {};
  const pro = await Pro.findOneAndUpdate(
    { userId },
    { $set: { displayName, city, services, verified: !!verified, active: true } },
    { new: true, upsert: true }
  );
  res.status(201).json(pro);
});

// Listado con filtros
r.get('/pros', async (req, res) => {
  const { service, city, page = 1, limit = 10 } = req.query as any;
  const q: any = { active: true };
  if (service) q['services.key'] = service;
  if (city) q.city = new RegExp(`^${city}$`, 'i');
  const items = await Pro.find(q).sort({ ratingAvg: -1, jobsDone: -1 })
    .skip((+page - 1) * +limit).limit(+limit);
  const total = await Pro.countDocuments(q);
  res.json({ items, total, page: +page, limit: +limit });
});
export default r;
