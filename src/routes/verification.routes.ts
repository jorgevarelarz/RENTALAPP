import { Router } from 'express';
import { Types } from 'mongoose';
import { Verification } from '../models/verification.model';
import { getUserId } from '../utils/getUserId';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/requireAdmin';
import { sendRouteError } from '../utils/routeError';
import { User } from '../models/user.model';

const router = Router();

// Todas las rutas necesitan sesión. Antes approve/reject/dev/verify no pasaban por
// authenticate: requireAdmin no encontraba req.user y respondían 403 incluso al administrador.
router.use(authenticate);

async function findTargetUser(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return { error: 'invalid_user_id' as const, status: 400 };
  const exists = await User.exists({ _id: userId });
  if (!exists) return { error: 'user_not_found' as const, status: 404 };
  return null;
}

// Retrieve current verification status for the authenticated user
router.get('/me', async (req, res) => {
  try {
    const userId = getUserId(req);
    const v = await Verification.findOne({ userId }).lean();
    if (!v) return res.json({ status: 'unverified' });
    res.json(v);
  } catch (err: any) {
    sendRouteError(res, err, 'verification_request_failed');
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
    sendRouteError(res, err, 'verification_request_failed');
  }
});

// Admin approves verification for a user
router.post('/:userId/approve', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const invalid = await findTargetUser(userId);
    if (invalid) return res.status(invalid.status).json({ error: invalid.error });
    const v = await Verification.findOneAndUpdate(
      { userId },
      { $set: { status: 'verified', notes: '' } },
      { new: true, upsert: true },
    );
    res.json(v);
  } catch (err: any) {
    sendRouteError(res, err, 'verification_request_failed');
  }
});

// Admin rejects verification for a user with notes
router.post('/:userId/reject', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const invalid = await findTargetUser(userId);
    if (invalid) return res.status(invalid.status).json({ error: invalid.error });
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 1000) : '';
    const v = await Verification.findOneAndUpdate(
      { userId },
      { $set: { status: 'rejected', notes } },
      { new: true, upsert: true },
    );
    res.json(v);
  } catch (err: any) {
    sendRouteError(res, err, 'verification_request_failed');
  }
});

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
    sendRouteError(res, err, 'verification_request_failed');
  }
});

export default router;
