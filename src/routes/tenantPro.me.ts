import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/user.model';
import { deleteTP } from '../services/tenantProStorage';
import { assertRole } from '../middleware/assertRole';

const router = Router();

router.get(
  '/me/tenant-pro',
  ...assertRole('tenant'),
  asyncHandler(async (req, res) => {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ error: 'auth_required' });
    const user = (await User.findById(userId)
      .select('tenantPro email')
      .lean()) as any;
    if (!user) return res.sendStatus(404);
    res.json({ tenantPro: user.tenantPro });
  }),
);

router.post(
  '/me/tenant-pro/delete',
  ...assertRole('tenant'),
  asyncHandler(async (req, res) => {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ error: 'auth_required' });
    const user = (await User.findById(userId)) as any;
    if (!user) return res.sendStatus(404);

    for (const doc of user.tenantPro?.docs || []) {
      if (doc?.url) deleteTP(doc.url as any);
    }

    user.tenantPro = {
      isActive: false,
      maxRent: 0,
      status: 'none',
      docs: [],
      auditTrail: [],
      consentAccepted: false,
      consentTextVersion: undefined,
      consentAcceptedAt: undefined,
      lastDecisionAt: undefined,
    } as any;

    await user.save();
    res.json({ ok: true });
  }),
);

export default router;
