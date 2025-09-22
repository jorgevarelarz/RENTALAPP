import { Router } from 'express';
import { PostSignUpsell } from '../models/PostSignUpsell';
import { Service } from '../models/Service';
import { ServiceClick } from '../models/ServiceClick';

const router = Router();

const computeRemindAt = ({ minutes = 0, hours = 0, days = 3 } = {}) => {
  const d = new Date();
  if (minutes) d.setMinutes(d.getMinutes() + minutes);
  if (hours) d.setHours(d.getHours() + hours);
  if (days) d.setDate(d.getDate() + days);
  return d;
};

// GET estado + servicios
router.get('/postsign/upsell/:contractId', async (req: any, res) => {
  const { id: userId } = req.user || {};
  const { contractId } = req.params;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  let u = await PostSignUpsell.findOne({ userId, contractId });
  if (!u) u = await PostSignUpsell.create({ userId, contractId, status: 'pending' });

  const services = await Service.find({ active: true }).sort({ priority: 1 }).lean();
  res.json({ status: u.status, remindAt: u.remindAt, address: u.address, services });
});

// CLICK contratar (tracking)
router.post('/postsign/upsell/:contractId/click', async (req: any, res) => {
  const { id: userId } = req.user || {};
  const { contractId } = req.params;
  const { serviceId } = req.body || {};
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  if (!serviceId) return res.status(400).json({ error: 'serviceId_required' });

  await ServiceClick.create({ userId, contractId, serviceId, ts: new Date() });
  await PostSignUpsell.updateOne({ userId, contractId }, { $set: { status: 'completed', updatedAt: new Date() } }, { upsert: true });
  res.sendStatus(204);
});

// MÁS TARDE
router.post('/postsign/upsell/:contractId/remind-later', async (req: any, res) => {
  const { id: userId } = req.user || {};
  const { contractId } = req.params;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const remindAt = computeRemindAt(req.body || {});
  await PostSignUpsell.updateOne(
    { userId, contractId },
    { $set: { status: 'remind_later', remindAt } },
    { upsert: true },
  );
  res.json({ status: 'remind_later', remindAt });
});

// AHORA NO
router.post('/postsign/upsell/:contractId/dismiss', async (req: any, res) => {
  const { id: userId } = req.user || {};
  const { contractId } = req.params;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  await PostSignUpsell.updateOne(
    { userId, contractId },
    { $set: { status: 'dismissed', remindAt: null } },
    { upsert: true },
  );
  res.json({ status: 'dismissed' });
});

export default router;

