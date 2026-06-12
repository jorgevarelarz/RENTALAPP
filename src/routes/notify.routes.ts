import { Router, Request, Response, NextFunction } from 'express';
import { sendEmail, sendSms } from '../utils/notification';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

router.use((_req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not_found' });
  next();
});

router.post('/notify/email', authenticate, requireAdmin, async (req, res) => {
  const { to, subject, body } = req.body || {};
  await sendEmail(to, subject, body);
  res.json({ ok: true });
});

router.post('/notify/sms', authenticate, requireAdmin, async (req, res) => {
  const { to, body } = req.body || {};
  await sendSms(to, body);
  res.json({ ok: true });
});

export default router;
