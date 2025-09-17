import { Router } from 'express';
import { sendEmail, sendSms } from '../utils/notification';

const router = Router();

router.post('/notify/email', async (req, res) => {
  const { to, subject, body } = req.body || {};
  await sendEmail(to, subject, body);
  res.json({ ok: true });
});

router.post('/notify/sms', async (req, res) => {
  const { to, body } = req.body || {};
  await sendSms(to, body);
  res.json({ ok: true });
});

export default router;
