import { Router } from 'express';
import { Verification } from '../models/verification.model';
import { getUserId } from '../utils/getUserId';
import { requireAdmin } from '../middleware/requireAdmin';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All verification routes (except potential public webhooks) require an authenticated user.
router.use(authenticate as any);

// Retrieve current verification status for the authenticated user
router.get('/me', async (req, res) => {
  try {
    const userId = getUserId(req);
    const v = await Verification.findOne({ userId }).lean();
    if (!v) return res.json({ status: 'unverified' });
    res.json(v);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

// Submit verification data by the user
router.post('/submit', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { method, files } = req.body || {};
    const v = await Verification.findOneAndUpdate(
      { userId },
      { $set: { method, files, status: 'pending', notes: '' } },
      { new: true, upsert: true, runValidators: true },
    );
    res.status(201).json(v);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

// Admin approves verification for a user
router.post('/:userId/approve', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const v = await Verification.findOneAndUpdate(
      { userId },
      { $set: { status: 'verified', notes: '' } },
      { new: true, upsert: true },
    );
    res.json(v);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

// Admin rejects verification for a user with notes
router.post('/:userId/reject', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { notes } = req.body || {};
    const v = await Verification.findOneAndUpdate(
      { userId },
      { $set: { status: 'rejected', notes } },
      { new: true, upsert: true },
    );
    res.json(v);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

export default router;

// Dev helper: instantly verify current user if ALLOW_UNVERIFIED=true (non-prod)
router.post('/dev/verify', async (req, res) => {
  if (!(process.env.ALLOW_UNVERIFIED === 'true' && process.env.NODE_ENV !== 'production')) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const userId = getUserId(req);
    const v = await Verification.findOneAndUpdate(
      { userId },
      { $set: { status: 'verified' } },
      { upsert: true, new: true },
    );
    res.json(v);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});
